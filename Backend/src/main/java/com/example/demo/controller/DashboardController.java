package com.example.demo.controller;

import jakarta.annotation.PostConstruct;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.util.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;

import org.springframework.ui.ModelMap;

import com.example.demo.service.DBDashboard;
import com.example.demo.dto.UpdateServiceRequest;
import com.example.demo.dto.PartDTO;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class DashboardController {

    // Upload directory - Absolute path
    private final String UPLOAD_DIR = System.getProperty("user.dir") + "/uploads/";
    
    // Track recent requests to prevent duplicates
    private final Set<String> recentRequests = new HashSet<>();

    // Create uploads folder on startup
    @PostConstruct
    public void createUploadFolder() {
        try {
            Path path = Paths.get(UPLOAD_DIR);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                System.out.println("✅ Uploads folder created at: " + path.toAbsolutePath());
            } else {
                System.out.println("✅ Uploads folder exists at: " + path.toAbsolutePath());
            }
        } catch (Exception e) {
            System.err.println("❌ Failed to create uploads folder: " + e.getMessage());
        }
    }

    // File Upload Endpoint
    @PostMapping("/uploadFile")
    public Map<String, String> uploadFile(@RequestParam("file") MultipartFile file) {
        Map<String, String> response = new HashMap<>();
        
        try {
            Path path = Paths.get(UPLOAD_DIR);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
            
            String originalName = file.getOriginalFilename();
            String timestamp = String.valueOf(System.currentTimeMillis());
            String safeFileName = originalName.replaceAll("[^a-zA-Z0-9.-]", "_");
            String fileName = timestamp + "_" + safeFileName;
            
            Path filePath = Paths.get(UPLOAD_DIR + fileName);
            Files.write(filePath, file.getBytes());
            
            response.put("status", "success");
            response.put("fileName", fileName);
            response.put("originalName", originalName);
            
            System.out.println("✅ File uploaded: " + fileName);
            
        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", "error");
            response.put("message", e.getMessage());
        }
        
        return response;
    }

    // ✅ UPDATED - View file in Chrome (inline instead of attachment)
    @GetMapping("/files/{filename}")
    public ResponseEntity<Resource> serveFile(@PathVariable("filename") String filename) {
        try {
            String decodedFilename = java.net.URLDecoder.decode(filename, "UTF-8");
            
            // Prevent duplicate rapid requests
            String requestKey = decodedFilename + "_" + Thread.currentThread().getName();
            if (recentRequests.contains(requestKey)) {
                System.out.println("⏭️ Skipping duplicate request: " + decodedFilename);
                return ResponseEntity.ok().build();
            }
            recentRequests.add(requestKey);
            
            // Remove from set after 3 seconds
            new Thread(() -> {
                try { Thread.sleep(3000); } catch (InterruptedException e) {}
                recentRequests.remove(requestKey);
            }).start();
            
            Path uploadPath = Paths.get(UPLOAD_DIR);
            
            System.out.println("🔍 Looking for: " + decodedFilename);
            System.out.println("⏰ Time: " + new Date());
            
            // Try exact match first
            Path exactPath = Paths.get(UPLOAD_DIR + decodedFilename).normalize();
            Resource resource = null;
            Path filePath = null;
            
            if (Files.exists(exactPath)) {
                filePath = exactPath;
                resource = new UrlResource(filePath.toUri());
                System.out.println("✅ Exact match found: " + filePath.getFileName());
            } else {
                // Try partial match - search for file containing the name
                String searchName = decodedFilename;
                if (decodedFilename.contains("_")) {
                    String[] parts = decodedFilename.split("_", 2);
                    if (parts[0].matches("\\d+")) {
                        searchName = parts[1];
                    }
                }
                
                System.out.println("🔍 Searching partial match for: " + searchName);
                
                Path foundFile = null;
                if (Files.exists(uploadPath)) {
                    for (Path path : Files.list(uploadPath).toArray(Path[]::new)) {
                        if (path.getFileName().toString().contains(searchName)) {
                            foundFile = path;
                            break;
                        }
                    }
                }
                
                if (foundFile != null) {
                    filePath = foundFile;
                    resource = new UrlResource(filePath.toUri());
                    System.out.println("✅ Partial match found: " + filePath.getFileName());
                }
            }
            
            if (resource == null || !resource.exists()) {
                System.out.println("❌ File not found: " + decodedFilename);
                recentRequests.remove(requestKey);
                return ResponseEntity.notFound().build();
            }
            
            String fileName = filePath.getFileName().toString();
            String fileExtension = "";
            if (fileName.contains(".")) {
                fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
            }
            
            // Set correct content type based on file extension
            String contentType;
            switch (fileExtension) {
                case ".pdf":
                    contentType = "application/pdf";
                    break;
                case ".jpg":
                case ".jpeg":
                    contentType = "image/jpeg";
                    break;
                case ".png":
                    contentType = "image/png";
                    break;
                case ".gif":
                    contentType = "image/gif";
                    break;
                case ".txt":
                    contentType = "text/plain";
                    break;
                case ".doc":
                    contentType = "application/msword";
                    break;
                case ".docx":
                    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    break;
                default:
                    contentType = "application/octet-stream";
            }
            
            // 🔥 CRITICAL CHANGE: Use "inline" instead of "attachment"
            // "inline" = VIEW in browser (Chrome will open the file)
            // "attachment" = FORCE DOWNLOAD
            String disposition = "inline; filename=\"" + fileName + "\"";
            
            System.out.println("📄 Serving file: " + fileName);
            System.out.println("   Content-Type: " + contentType);
            System.out.println("   Disposition: " + disposition);
            
            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate, private")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .header("Surrogate-Control", "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .header("ETag", String.valueOf(System.currentTimeMillis()))
                .header("Last-Modified", new SimpleDateFormat("EEE, d MMM yyyy HH:mm:ss z").format(new Date()))
                .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(resource);
                
        } catch (IOException e) {
            System.err.println("❌ IO Error: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        } catch (Exception e) {
            System.err.println("❌ Error serving file: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // Clear cache endpoint - Call this from app to reset
    @GetMapping("/clear-cache")
    public Map<String, String> clearCache() {
        Map<String, String> response = new HashMap<>();
        recentRequests.clear();
        response.put("status", "success");
        response.put("timestamp", String.valueOf(System.currentTimeMillis()));
        response.put("message", "Cache cleared successfully");
        System.out.println("🗑️ Cache cleared at: " + new Date());
        return response;
    }

    // Debug endpoint - Check what files exist
    @GetMapping("/debug-uploads")
    public Map<String, Object> debugUploads() {
        Map<String, Object> response = new HashMap<>();
        List<String> files = new ArrayList<>();
        
        try {
            Path uploadPath = Paths.get(UPLOAD_DIR);
            response.put("uploadPath", uploadPath.toAbsolutePath().toString());
            response.put("pathExists", Files.exists(uploadPath));
            
            if (Files.exists(uploadPath)) {
                for (Path file : Files.list(uploadPath).toArray(Path[]::new)) {
                    files.add(file.getFileName().toString());
                }
                response.put("files", files);
                response.put("fileCount", files.size());
                System.out.println("📁 Found " + files.size() + " files in uploads folder");
            } else {
                response.put("error", "Uploads folder does not exist");
            }
            
        } catch (Exception e) {
            response.put("error", e.getMessage());
        }
        
        return response;
    }

    // List all files
    @GetMapping("/files-list")
    public List<String> listFiles() {
        List<String> files = new ArrayList<>();
        try {
            Path path = Paths.get(UPLOAD_DIR);
            if (Files.exists(path)) {
                for (Path file : Files.list(path).toArray(Path[]::new)) {
                    files.add(file.getFileName().toString());
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return files;
    }

    // Dashboard endpoint
    @GetMapping("/dashboard/{empId}")
    public ModelMap getDashboard(@PathVariable("empId") String empId) {
        System.out.println("📱 Fetching dashboard for empId: " + empId);
        ModelMap result = DBDashboard.getDashboardData(empId);
        
        List<?> complaints = (List<?>) result.get("complaints");
        if (complaints != null) {
            System.out.println("✅ Response size: " + complaints.size() + " complaints");
        } else {
            result.put("complaints", new ArrayList<>());
        }
        
        return result;
    }

    // Parts by category
    @GetMapping("/parts/{categoryId}")
    public List<Map<String, Object>> getParts(@PathVariable("categoryId") int categoryId) {
        System.out.println("🔧 Fetching parts for category: " + categoryId);
        return DBDashboard.getPartsByCategory(categoryId);
    }

    // Get Service Types from Database
    @GetMapping("/service-types")
    public List<Map<String, Object>> getServiceTypes() {
        System.out.println("📋 Fetching service types from database");
        List<Map<String, Object>> list = new ArrayList<>();
        
        try {
            java.sql.Connection conn = com.example.demo.utils.ConnectionManager.getConnection();
            
            String checkSql = "SELECT COUNT(*) as count FROM ServiceTypeMaster";
            java.sql.PreparedStatement checkPs = conn.prepareStatement(checkSql);
            java.sql.ResultSet checkRs = checkPs.executeQuery();
            int count = 0;
            if (checkRs.next()) {
                count = checkRs.getInt("count");
            }
            checkRs.close();
            checkPs.close();
            
            System.out.println("   ServiceTypeMaster table has " + count + " records");
            
            if (count == 0) {
                System.out.println("⚠️ No service types found in database! Please insert data.");
                conn.close();
                return list;
            }
            
            String sql = "SELECT ServiceTypeID, ServiceTypeName, Rate, UnitOfMeasure FROM ServiceTypeMaster ORDER BY ServiceTypeID";
            java.sql.PreparedStatement ps = conn.prepareStatement(sql);
            java.sql.ResultSet rs = ps.executeQuery();
            
            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", rs.getInt("ServiceTypeID"));
                map.put("name", rs.getString("ServiceTypeName"));
                map.put("rate", rs.getDouble("Rate"));
                map.put("unit", rs.getString("UnitOfMeasure") != null ? rs.getString("UnitOfMeasure") : "SERVICE");
                list.add(map);
                
                System.out.println("   → Service Type: ID=" + rs.getInt("ServiceTypeID") + 
                                 ", Name=" + rs.getString("ServiceTypeName") + 
                                 ", Rate=" + rs.getDouble("Rate"));
            }
            rs.close();
            ps.close();
            conn.close();
            
            System.out.println("✅ Successfully fetched " + list.size() + " service types from database");
            
        } catch (Exception e) {
            System.err.println("❌ Error fetching service types: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
        
        return list;
    }

    // Update service with service type fields
    @PostMapping("/updateService")
    public Map<String, String> updateService(@RequestBody UpdateServiceRequest req) {
        
        Map<String, String> response = new HashMap<>();
        
        try {
            if (req == null) {
                response.put("status", "error");
                response.put("message", "Invalid Request");
                return response;
            }

            if (req.getSrid() == 0) {
                response.put("status", "error");
                response.put("message", "Invalid SRID");
                return response;
            }

            if (req.getEquipmentId() == 0) {
                response.put("status", "error");
                response.put("message", "Invalid Equipment ID");
                return response;
            }

            Object finalServiceTypeId = req.getServiceTypeId();
            if (finalServiceTypeId != null) {
                String idStr = finalServiceTypeId.toString();
                if (idStr.contains(",")) {
                    finalServiceTypeId = idStr.split(",")[0].trim();
                    System.out.println("⚠️ Multiple service types detected. Using only first: " + finalServiceTypeId);
                }
            }

            System.out.println("========================================");
            System.out.println("📝 UPDATE SERVICE REQUEST:");
            System.out.println("   SRID: " + req.getSrid());
            System.out.println("   Equipment ID: " + req.getEquipmentId());
            System.out.println("   Status: " + req.getStatus());
            System.out.println("   Remarks: " + req.getRemarks());
            System.out.println("   File: " + req.getFile());
            System.out.println("   Service Type ID (processed): " + finalServiceTypeId);
            System.out.println("   Service Rate: " + req.getServiceRate());
            System.out.println("   Service Unit: " + req.getServiceUnit());
            System.out.println("   Parts Count: " + (req.getParts() != null ? req.getParts().size() : 0));
            System.out.println("========================================");

            String result = DBDashboard.updateService(
                req.getSrid(),
                req.getEquipmentId(),
                req.getRemarks(),
                req.getStatus(),
                req.getFile(),
                finalServiceTypeId,
                req.getServiceRate(),
                req.getServiceUnit(),
                convertParts(req.getParts())
            );

            if ("Success".equals(result)) {
                response.put("status", "success");
                response.put("message", "Service updated successfully");
                System.out.println("✅ Update successful!");
            } else {
                response.put("status", "error");
                response.put("message", result);
                System.out.println("❌ Update failed: " + result);
            }

        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", "error");
            response.put("message", "Exception: " + e.getMessage());
        }
        
        return response;
    }

    // Delete part
    @PostMapping("/deletePart")
    public Map<String, String> deletePart(@RequestBody Map<String, Integer> request) {
        Map<String, String> response = new HashMap<>();
        
        try {
            System.out.println("========================================");
            System.out.println("🗑️ DELETE PART REQUEST:");
            
            if (request == null) {
                System.out.println("❌ Request body is null");
                response.put("status", "error");
                response.put("message", "Invalid request body");
                return response;
            }
            
            Integer srid = request.get("srid");
            Integer equipmentId = request.get("equipmentId");
            Integer partId = request.get("partId");
            
            System.out.println("   SRID: " + srid);
            System.out.println("   Equipment ID: " + equipmentId);
            System.out.println("   Part ID: " + partId);
            
            if (srid == null || srid == 0) {
                System.out.println("❌ Invalid SRID");
                response.put("status", "error");
                response.put("message", "Invalid SRID");
                return response;
            }
            
            if (equipmentId == null || equipmentId == 0) {
                System.out.println("❌ Invalid Equipment ID");
                response.put("status", "error");
                response.put("message", "Invalid Equipment ID");
                return response;
            }
            
            if (partId == null || partId == 0) {
                System.out.println("❌ Invalid Part ID");
                response.put("status", "error");
                response.put("message", "Invalid Part ID");
                return response;
            }
            
            System.out.println("========================================");
            
            String result = DBDashboard.deletePart(srid, equipmentId, partId);
            
            if ("Success".equals(result)) {
                response.put("status", "success");
                response.put("message", "Part deleted successfully");
                System.out.println("✅ Part deleted successfully!");
            } else {
                response.put("status", "error");
                response.put("message", result);
                System.out.println("❌ Delete failed: " + result);
            }
            
        } catch (Exception e) {
            System.err.println("❌ Exception in deletePart: " + e.getMessage());
            e.printStackTrace();
            response.put("status", "error");
            response.put("message", "Exception: " + e.getMessage());
        }
        
        return response;
    }

    // Get single service request details
    @GetMapping("/servicerequest/{srid}")
    public ModelMap getServiceRequestDetails(@PathVariable("srid") int srid) {
        ModelMap result = new ModelMap();
        try {
            result.put("srid", srid);
            result.put("message", "Use dashboard API to get full details");
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        return result;
    }

    // Convert part DTO to map
    private List<Map<String, Object>> convertParts(List<PartDTO> parts) {
        List<Map<String, Object>> list = new ArrayList<>();

        if (parts == null || parts.isEmpty()) {
            System.out.println("⚠️ No parts to convert");
            return list;
        }

        for (PartDTO p : parts) {
            if (p.getPartId() == 0 || p.getQty() == 0) {
                System.out.println("⚠️ Skipping invalid part - ID: " + p.getPartId() + ", Qty: " + p.getQty());
                continue;
            }

            Map<String, Object> map = new HashMap<>();
            map.put("partId", p.getPartId());
            map.put("qty", p.getQty());
            list.add(map);
            
            System.out.println("   Part added - ID: " + p.getPartId() + ", Qty: " + p.getQty());
        }

        return list;
    }

    // Get plants with district for an employee
    @GetMapping("/plants-district/{empId}")
    public List<Map<String, Object>> getPlantsWithDistrict(@PathVariable("empId") String empId) {
        System.out.println("🌱 Fetching plants with district for empId: " + empId);
        return DBDashboard.getPlantsWithDistrict(empId);
    }
 // Get employee pending services (detailed list - plant, equipment, issue)
    @GetMapping("/admin/employee-pending-services/{employeeId}")
    public Map<String, Object> getEmployeePendingServices(@PathVariable("employeeId") int employeeId) {
        Map<String, Object> response = new HashMap<>();
        System.out.println("📋 Fetching pending services for employee: " + employeeId);
        
        try {
            List<Map<String, Object>> pendingList = DBDashboard.getEmployeePendingServices(employeeId);
            response.put("status", "success");
            response.put("pendingServices", pendingList);
            System.out.println("✅ Found " + pendingList.size() + " pending services");
        } catch (Exception e) {
            System.err.println("❌ Error fetching pending services: " + e.getMessage());
            e.printStackTrace();
            response.put("status", "error");
            response.put("message", e.getMessage());
            response.put("pendingServices", new ArrayList<>());
        }
        
        return response;
    }
}