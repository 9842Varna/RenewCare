package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.util.*;
import java.sql.*;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/profile")
public class EmployeeProfileController {

    @GetMapping("/{empId}")
    public Map<String, Object> getEmployeeProfile(@PathVariable("empId") String empId) {
        Map<String, Object> response = new HashMap<>();
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        
        try {
            conn = com.example.demo.utils.ConnectionManager.getConnection();
            
            String sql = "SELECT e.EmployeeID, e.EmployeeName, e.DateJoin, e.Address1, e.Address2, " +
                         "e.TalukName, e.Phone, e.Email, e.Gender, e.IsActive, e.ProfileImage, " +
                         "r.RollDescription as RoleName, " +
                         "s.StateName as StateName, " +
                         "d.DistrictName as DistrictName " +
                         "FROM Employee e " +
                         "LEFT JOIN EmployeeRoles r ON e.Role = r.RollID " +
                         "LEFT JOIN State s ON e.StateCode = s.StateCode " +
                         "LEFT JOIN District d ON e.DistrictCode = d.DistrictCode " +
                         "WHERE e.EmployeeID = ?";
            
            ps = conn.prepareStatement(sql);
            ps.setString(1, empId);
            rs = ps.executeQuery();
            
            if (rs.next()) {
                response.put("id", rs.getString("EmployeeID"));
                response.put("name", rs.getString("EmployeeName"));
                response.put("email", rs.getString("Email"));
                response.put("phone", rs.getString("Phone"));
                response.put("address1", rs.getString("Address1"));
                response.put("address2", rs.getString("Address2"));
                response.put("talukName", rs.getString("TalukName"));
                response.put("role", rs.getString("RoleName"));
                response.put("stateName", rs.getString("StateName"));
                response.put("districtName", rs.getString("DistrictName"));
                response.put("gender", rs.getString("Gender"));
                response.put("joiningDate", rs.getString("DateJoin"));
                response.put("isActive", rs.getBoolean("IsActive"));
            }
            rs.close();
            ps.close();
            
            response.putAll(getEmployeeStats(conn, empId));
            conn.close();
            
        } catch (Exception e) {
            response.put("error", e.getMessage());
            e.printStackTrace();
        }
        return response;
    }

    private Map<String, Object> getEmployeeStats(Connection conn, String empId) {
        Map<String, Object> stats = new HashMap<>();
        PreparedStatement ps = null;
        ResultSet rs = null;
        
        try {
            int employeeIdInt = Integer.parseInt(empId);
            
            // Get all distinct SRIDs where employee is ServicedBy
            String sqlAll = "SELECT DISTINCT SRID FROM ServiceRequestDetail WHERE ServicedBy = ?";
            ps = conn.prepareStatement(sqlAll);
            ps.setInt(1, employeeIdInt);
            rs = ps.executeQuery();
            
            List<Integer> allSrIds = new ArrayList<>();
            while (rs.next()) {
                allSrIds.add(rs.getInt("SRID"));
            }
            rs.close();
            ps.close();
            
            int total = allSrIds.size();
            int completed = 0;
            int inProgress = 0;
            
            // For each SRID, check if all equipments are completed
            for (int srid : allSrIds) {
                String sqlCheck = "SELECT COUNT(*) as total_eq, " +
                                  "SUM(CASE WHEN ServiceStatus = 'C' THEN 1 ELSE 0 END) as completed_eq " +
                                  "FROM ServiceRequestDetail WHERE SRID = ? AND ServicedBy = ?";
                ps = conn.prepareStatement(sqlCheck);
                ps.setInt(1, srid);
                ps.setInt(2, employeeIdInt);
                rs = ps.executeQuery();
                
                if (rs.next()) {
                    int totalEq = rs.getInt("total_eq");
                    int completedEq = rs.getInt("completed_eq");
                    
                    if (totalEq > 0 && completedEq == totalEq) {
                        completed++;
                    } else if (totalEq > 0 && completedEq > 0) {
                        inProgress++;
                    }
                }
                rs.close();
                ps.close();
            }
            
            int pending = total - completed - inProgress;
            if (pending < 0) pending = 0;
            
            stats.put("total_services", total);
            stats.put("completed_services", completed);
            stats.put("pending_services", pending);
            stats.put("inprogress_services", inProgress);
            stats.put("completion_rate", total > 0 ? (completed * 100 / total) : 0);
            
            System.out.println("📊 Statistics for Employee " + empId + ":");
            System.out.println("   Total: " + total);
            System.out.println("   Completed: " + completed);
            System.out.println("   In Progress: " + inProgress);
            System.out.println("   Pending: " + pending);
            
        } catch (Exception e) {
            stats.put("error", e.getMessage());
            e.printStackTrace();
        }
        return stats;
    }

    @PostMapping("/update-image")
    public Map<String, String> updateProfileImage(
            @RequestParam("empId") String empId,
            @RequestParam("file") MultipartFile file) {
        Map<String, String> response = new HashMap<>();
        Connection conn = null;
        PreparedStatement ps = null;
        
        try {
            byte[] imageBytes = file.getBytes();
            
            conn = com.example.demo.utils.ConnectionManager.getConnection();
            String sql = "UPDATE Employee SET ProfileImage = ? WHERE EmployeeID = ?";
            ps = conn.prepareStatement(sql);
            ps.setBytes(1, imageBytes);
            ps.setString(2, empId);
            
            int updated = ps.executeUpdate();
            ps.close();
            conn.close();
            
            if (updated > 0) {
                response.put("status", "success");
                response.put("message", "Profile image updated successfully");
            } else {
                response.put("status", "error");
                response.put("message", "Employee not found");
            }
            
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
            e.printStackTrace();
        }
        return response;
    }

    @PostMapping("/delete-image")
    public Map<String, String> deleteProfileImage(@RequestBody Map<String, String> request) {
        Map<String, String> response = new HashMap<>();
        Connection conn = null;
        PreparedStatement ps = null;
        
        try {
            String empId = request.get("empId");
            
            conn = com.example.demo.utils.ConnectionManager.getConnection();
            String sql = "UPDATE Employee SET ProfileImage = NULL WHERE EmployeeID = ?";
            ps = conn.prepareStatement(sql);
            ps.setString(1, empId);
            
            int updated = ps.executeUpdate();
            ps.close();
            conn.close();
            
            if (updated > 0) {
                response.put("status", "success");
                response.put("message", "Profile image deleted successfully");
            } else {
                response.put("status", "error");
                response.put("message", "Employee not found");
            }
            
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
        }
        return response;
    }

    @GetMapping("/image/{empId}")
    public ResponseEntity<byte[]> getProfileImage(@PathVariable("empId") String empId) {
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        
        try {
            conn = com.example.demo.utils.ConnectionManager.getConnection();
            String sql = "SELECT ProfileImage FROM Employee WHERE EmployeeID = ?";
            ps = conn.prepareStatement(sql);
            ps.setString(1, empId);
            rs = ps.executeQuery();
            
            if (rs.next()) {
                byte[] imageBytes = rs.getBytes("ProfileImage");
                if (imageBytes != null && imageBytes.length > 0) {
                    rs.close();
                    ps.close();
                    conn.close();
                    return ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                        .body(imageBytes);
                }
            }
            rs.close();
            ps.close();
            conn.close();
            
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/update")
    public Map<String, String> updateProfile(@RequestBody Map<String, String> request) {
        Map<String, String> response = new HashMap<>();
        Connection conn = null;
        PreparedStatement ps = null;
        
        try {
            String empId = request.get("empId");
            String name = request.get("name");
            String email = request.get("email");
            String phone = request.get("phone");
            String address1 = request.get("address1");
            String address2 = request.get("address2");
            String talukName = request.get("talukName");
            String gender = request.get("gender");
            
            conn = com.example.demo.utils.ConnectionManager.getConnection();
            String sql = "UPDATE Employee SET EmployeeName = ?, Email = ?, Phone = ?, " +
                         "Address1 = ?, Address2 = ?, TalukName = ?, Gender = ? WHERE EmployeeID = ?";
            ps = conn.prepareStatement(sql);
            ps.setString(1, name);
            ps.setString(2, email);
            ps.setString(3, phone);
            ps.setString(4, address1);
            ps.setString(5, address2);
            ps.setString(6, talukName);
            ps.setString(7, gender);
            ps.setString(8, empId);
            
            int updated = ps.executeUpdate();
            ps.close();
            conn.close();
            
            if (updated > 0) {
                response.put("status", "success");
                response.put("message", "Profile updated successfully");
            } else {
                response.put("status", "error");
                response.put("message", "Update failed");
            }
            
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
        }
        return response;
    }
}