package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.ui.ModelMap;
import java.sql.*;
import java.util.*;
import com.example.demo.utils.ConnectionManager;

@Service
public class AdminService {

    // ==================== DASHBOARD ====================
    
	public ModelMap getDashboardStats() {
	    ModelMap res = new ModelMap();
	    Connection conn = null;
	    
	    try {
	        conn = ConnectionManager.getConnection();
	        
	        // ✅ Customer count
	        String customerSql = "SELECT COUNT(*) AS total FROM Customer";
	        PreparedStatement pstmt = conn.prepareStatement(customerSql);
	        ResultSet rs = pstmt.executeQuery();
	        int totalCustomers = rs.next() ? rs.getInt("total") : 0;
	        rs.close(); pstmt.close();
	        
	        // ✅ Plant count
	        String plantSql = "SELECT COUNT(*) AS total FROM Plant WHERE IsActive = 1";
	        pstmt = conn.prepareStatement(plantSql);
	        rs = pstmt.executeQuery();
	        int totalPlants = rs.next() ? rs.getInt("total") : 0;
	        rs.close(); pstmt.close();
	        
	        // ✅ Service count
	        String serviceSql = "SELECT COUNT(*) AS total FROM ServiceRequest";
	        pstmt = conn.prepareStatement(serviceSql);
	        rs = pstmt.executeQuery();
	        int totalServices = rs.next() ? rs.getInt("total") : 0;
	        rs.close(); pstmt.close();
	        
	        // ✅ Revenue from ServiceParts
	        String revenueSql = "SELECT ISNULL(SUM(sp.Quantity * sp.Rate), 0) AS total FROM ServiceParts sp";
	        pstmt = conn.prepareStatement(revenueSql);
	        rs = pstmt.executeQuery();
	        double totalRevenue = rs.next() ? rs.getDouble("total") : 0;
	        rs.close(); pstmt.close();
	        
	        // If no revenue from ServiceParts, get from ServiceRequestDetail
	        if (totalRevenue == 0) {
	            String altRevenueSql = "SELECT ISNULL(SUM(ServiceRate), 0) AS total FROM ServiceRequestDetail WHERE ServiceStatus = 'C'";
	            pstmt = conn.prepareStatement(altRevenueSql);
	            rs = pstmt.executeQuery();
	            totalRevenue = rs.next() ? rs.getDouble("total") : 0;
	            rs.close(); pstmt.close();
	        }
	        
	        res.put("status", "success");
	        res.put("total_customers", totalCustomers);
	        res.put("total_plants", totalPlants);
	        res.put("total_services", totalServices);
	        res.put("total_revenue", totalRevenue);
	        
	    } catch (Exception e) {
	        e.printStackTrace();
	        res.put("status", "error");
	        res.put("message", e.getMessage());
	        res.put("total_customers", 0);
	        res.put("total_plants", 0);
	        res.put("total_services", 0);
	        res.put("total_revenue", 0);
	    } finally {
	        try { if (conn != null) conn.close(); } catch (Exception e) {}
	    }
	    return res;
	}
    // ==================== PLANT MANAGEMENT ====================
    
    public ModelMap getAllPlants() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT p.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "p.IsActive, c.CustomerName, p.PlantIncharge, e.EmployeeName AS InchargeName, " +
                        "p.PlantCapacity, p.InstalledDate, p.LastServicedDate " +  // ✅ ADD THESE
                        "FROM Plant p " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN Customer c ON p.CustomerID = c.CustomerID " +
                        "LEFT JOIN Employee e ON p.PlantIncharge = e.EmployeeID " +
                        "WHERE p.IsActive = 1 " +
                        "ORDER BY p.PlantName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> plants = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap plant = new ModelMap();
                plant.put("id", rs.getInt("PlantID"));
                plant.put("name", rs.getString("PlantName"));
                plant.put("district", rs.getString("District"));
                plant.put("districtName", rs.getString("DistrictName"));
                plant.put("customer", rs.getString("CustomerName"));
                plant.put("inchargeId", rs.getInt("PlantIncharge"));
                plant.put("inchargeName", rs.getString("InchargeName"));
                plant.put("isActive", rs.getBoolean("IsActive"));
                
                // ✅ ADD THESE LINES
                plant.put("capacity", rs.getDouble("PlantCapacity"));
                plant.put("installedDate", rs.getString("InstalledDate"));
                plant.put("lastServicedDate", rs.getString("LastServicedDate"));
                
                plants.add(plant);
            }
            
            res.put("status", "success");
            res.put("plants", plants);
            res.put("count", plants.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getPlantById(int plantId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT p.*, d.DistrictName, c.CustomerName, e.EmployeeName AS InchargeName " +
                        "FROM Plant p " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN Customer c ON p.CustomerID = c.CustomerID " +
                        "LEFT JOIN Employee e ON p.PlantIncharge = e.EmployeeID " +
                        "WHERE p.PlantID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, plantId);
            ResultSet rs = pstmt.executeQuery();
            
            if (rs.next()) {
                res.put("id", rs.getInt("PlantID"));
                res.put("name", rs.getString("PlantName"));
                res.put("customerId", rs.getInt("CustomerID"));
                res.put("customerName", rs.getString("CustomerName"));
                res.put("state", rs.getString("State"));
                res.put("district", rs.getString("District"));
                res.put("districtName", rs.getString("DistrictName"));
                res.put("inchargeId", rs.getInt("PlantIncharge"));
                res.put("inchargeName", rs.getString("InchargeName"));
                res.put("installedDate", rs.getString("InstalledDate"));
                res.put("isActive", rs.getBoolean("IsActive"));
                
                // ✅ ADD THESE
                res.put("capacity", rs.getDouble("PlantCapacity"));
                res.put("lastServicedDate", rs.getString("LastServicedDate"));
                
                res.put("status", "success");
            } else {
                res.put("status", "error");
                res.put("message", "Plant not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
  
    
    public ModelMap createPlant(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String nextIdSql = "SELECT ISNULL(MAX(PlantID), 0) + 1 AS NextID FROM Plant";
            PreparedStatement pstmt = conn.prepareStatement(nextIdSql);
            ResultSet rs = pstmt.executeQuery();
            int nextId = rs.next() ? rs.getInt("NextID") : 1;
            rs.close();
            pstmt.close();
            
            String sql = "INSERT INTO Plant (PlantID, CustomerID, PlantName, State, District, " +
                        "PlantIncharge, PlantCapacity, InstalledDate, IsActive) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)";
            
            pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, nextId);
            pstmt.setInt(2, req.get("customerId") != null ? Integer.parseInt(req.get("customerId").toString()) : 0);
            pstmt.setString(3, req.get("plantName") != null ? req.get("plantName").toString() : "");
            pstmt.setString(4, req.get("state") != null ? req.get("state").toString() : "");
            pstmt.setString(5, req.get("district") != null ? req.get("district").toString() : "");
            pstmt.setInt(6, req.get("inchargeId") != null ? Integer.parseInt(req.get("inchargeId").toString()) : 0);
            pstmt.setDouble(7, req.get("capacity") != null ? Double.parseDouble(req.get("capacity").toString()) : 0);
            pstmt.setString(8, req.get("installedDate") != null ? req.get("installedDate").toString() : "");
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Plant created successfully");
                res.put("plantId", nextId);
            } else {
                res.put("status", "error");
                res.put("message", "Failed to create plant");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap updatePlant(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "UPDATE Plant SET PlantName = ?, CustomerID = ?, State = ?, " +
                        "District = ?, PlantIncharge = ?, PlantCapacity = ?, InstalledDate = ? " +
                        "WHERE PlantID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("plantName") != null ? req.get("plantName").toString() : "");
            pstmt.setInt(2, req.get("customerId") != null ? Integer.parseInt(req.get("customerId").toString()) : 0);
            pstmt.setString(3, req.get("state") != null ? req.get("state").toString() : "");
            pstmt.setString(4, req.get("district") != null ? req.get("district").toString() : "");
            pstmt.setInt(5, req.get("inchargeId") != null ? Integer.parseInt(req.get("inchargeId").toString()) : 0);
            pstmt.setDouble(6, req.get("capacity") != null ? Double.parseDouble(req.get("capacity").toString()) : 0);
            pstmt.setString(7, req.get("installedDate") != null ? req.get("installedDate").toString() : "");
            pstmt.setInt(8, req.get("plantId") != null ? Integer.parseInt(req.get("plantId").toString()) : 0);
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Plant updated successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Plant not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap deletePlant(int plantId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "UPDATE Plant SET IsActive = 0 WHERE PlantID = ?";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, plantId);
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Plant deleted successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Plant not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== CUSTOMER MANAGEMENT ====================
    
    public ModelMap getAllCustomers() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT c.CustomerID, c.CustomerName, c.Phone, c.Email, " +
                        "c.Address1, c.Address2, c.StateCode, c.DistrictCode, " +
                        "ISNULL(d.DistrictName, '') AS DistrictName, " +
                        "ISNULL(s.StateName, '') AS StateName, " +
                        "ISNULL((SELECT COUNT(*) FROM Plant WHERE CustomerID = c.CustomerID AND IsActive = 1), 0) AS PlantCount " +
                        "FROM Customer c " +
                        "LEFT JOIN District d ON c.DistrictCode = d.DistrictCode " +
                        "LEFT JOIN State s ON c.StateCode = s.StateCode " +
                        "ORDER BY c.CustomerName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> customers = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap customer = new ModelMap();
                customer.put("id", rs.getInt("CustomerID"));
                customer.put("name", rs.getString("CustomerName"));
                customer.put("phone", rs.getString("Phone"));
                customer.put("email", rs.getString("Email"));
                customer.put("address1", rs.getString("Address1"));
                customer.put("address2", rs.getString("Address2"));
                customer.put("stateCode", rs.getString("StateCode"));
                customer.put("stateName", rs.getString("StateName"));
                customer.put("districtCode", rs.getString("DistrictCode"));
                customer.put("districtName", rs.getString("DistrictName"));
                customer.put("plantCount", rs.getInt("PlantCount"));
                customers.add(customer);
            }
            
            res.put("status", "success");
            res.put("customers", customers);
            res.put("count", customers.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    public ModelMap getCustomerById(int customerId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT c.CustomerID, c.CustomerName, c.Phone, c.Email, " +
                        "c.Address1, c.Address2, c.StateCode, c.DistrictCode, " +
                        "ISNULL(d.DistrictName, '') AS DistrictName, " +
                        "ISNULL(s.StateName, '') AS StateName, " +
                        "ISNULL((SELECT COUNT(*) FROM Plant WHERE CustomerID = c.CustomerID AND IsActive = 1), 0) AS PlantCount " +
                        "FROM Customer c " +
                        "LEFT JOIN District d ON c.DistrictCode = d.DistrictCode " +
                        "LEFT JOIN State s ON c.StateCode = s.StateCode " +
                        "WHERE c.CustomerID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, customerId);
            ResultSet rs = pstmt.executeQuery();
            
            if (rs.next()) {
                res.put("id", rs.getInt("CustomerID"));
                res.put("name", rs.getString("CustomerName"));
                res.put("phone", rs.getString("Phone"));
                res.put("email", rs.getString("Email"));
                res.put("address1", rs.getString("Address1"));
                res.put("address2", rs.getString("Address2"));
                res.put("stateCode", rs.getString("StateCode"));
                res.put("stateName", rs.getString("StateName"));
                res.put("districtCode", rs.getString("DistrictCode"));
                res.put("districtName", rs.getString("DistrictName"));
                res.put("plantCount", rs.getInt("PlantCount"));
                res.put("status", "success");
            } else {
                res.put("status", "error");
                res.put("message", "Customer not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    public ModelMap getPlantsByCustomer(int customerId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT p.PlantID, p.PlantName, p.District, " +
                        "ISNULL(d.DistrictName, '') AS DistrictName, " +
                        "p.PlantCapacity, p.InstalledDate, p.LastServicedDate, " +
                        "ISNULL(e.EmployeeName, '') AS InchargeName, " +
                        "(SELECT COUNT(*) FROM ServiceRequest WHERE PlantID = p.PlantID) AS ServiceCount " +
                        "FROM Plant p " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN Employee e ON p.PlantIncharge = e.EmployeeID " +
                        "WHERE p.CustomerID = ? AND p.IsActive = 1 " +
                        "ORDER BY p.PlantName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, customerId);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> plants = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap plant = new ModelMap();
                plant.put("id", rs.getInt("PlantID"));
                plant.put("name", rs.getString("PlantName"));
                plant.put("district", rs.getString("District"));
                plant.put("districtName", rs.getString("DistrictName"));
                plant.put("capacity", rs.getDouble("PlantCapacity"));
                plant.put("installedDate", rs.getString("InstalledDate"));
                plant.put("lastServicedDate", rs.getString("LastServicedDate"));
                plant.put("inchargeName", rs.getString("InchargeName"));
                plant.put("serviceCount", rs.getInt("ServiceCount"));
                plants.add(plant);
            }
            
            res.put("status", "success");
            res.put("plants", plants);
            res.put("count", plants.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    public ModelMap getServicesByPlant(int plantId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT sr.SRID, sr.RequestDate, sr.ServiceDate, sr.Status, " +
                        "ISNULL(sr.ProblemDescription, '') AS ProblemDescription, " +
                        "(SELECT COUNT(*) FROM ServiceRequestDetail WHERE SRID = sr.SRID) AS EquipmentCount " +
                        "FROM ServiceRequest sr " +
                        "WHERE sr.PlantID = ? " +
                        "ORDER BY sr.SRID DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, plantId);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> services = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap service = new ModelMap();
                service.put("srid", rs.getInt("SRID"));
                service.put("requestDate", rs.getString("RequestDate"));
                service.put("serviceDate", rs.getString("ServiceDate"));
                service.put("status", rs.getString("Status"));
                service.put("problem", rs.getString("ProblemDescription"));
                service.put("equipmentCount", rs.getInt("EquipmentCount"));
                services.add(service);
            }
            
            res.put("status", "success");
            res.put("services", services);
            res.put("count", services.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap createCustomer(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String nextIdSql = "SELECT ISNULL(MAX(CustomerID), 0) + 1 AS NextID FROM Customer";
            PreparedStatement pstmt = conn.prepareStatement(nextIdSql);
            ResultSet rs = pstmt.executeQuery();
            int nextId = rs.next() ? rs.getInt("NextID") : 1;
            rs.close();
            pstmt.close();
            
            String sql = "INSERT INTO Customer (CustomerID, CustomerName, Phone, Email, " +
                        "Address1, Address2, StateCode, DistrictCode) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            
            pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, nextId);
            pstmt.setString(2, req.get("name") != null ? req.get("name").toString() : "");
            pstmt.setString(3, req.get("phone") != null ? req.get("phone").toString() : "");
            pstmt.setString(4, req.get("email") != null ? req.get("email").toString() : "");
            pstmt.setString(5, req.get("address1") != null ? req.get("address1").toString() : "");
            pstmt.setString(6, req.get("address2") != null ? req.get("address2").toString() : "");
            pstmt.setString(7, req.get("stateCode") != null ? req.get("stateCode").toString() : "");
            pstmt.setString(8, req.get("districtCode") != null ? req.get("districtCode").toString() : "");
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Customer created successfully");
                res.put("customerId", nextId);
            } else {
                res.put("status", "error");
                res.put("message", "Failed to create customer");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap updateCustomer(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "UPDATE Customer SET CustomerName = ?, Phone = ?, Email = ?, " +
                        "Address1 = ?, Address2 = ?, StateCode = ?, DistrictCode = ? " +
                        "WHERE CustomerID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("name") != null ? req.get("name").toString() : "");
            pstmt.setString(2, req.get("phone") != null ? req.get("phone").toString() : "");
            pstmt.setString(3, req.get("email") != null ? req.get("email").toString() : "");
            pstmt.setString(4, req.get("address1") != null ? req.get("address1").toString() : "");
            pstmt.setString(5, req.get("address2") != null ? req.get("address2").toString() : "");
            pstmt.setString(6, req.get("stateCode") != null ? req.get("stateCode").toString() : "");
            pstmt.setString(7, req.get("districtCode") != null ? req.get("districtCode").toString() : "");
            pstmt.setInt(8, req.get("customerId") != null ? Integer.parseInt(req.get("customerId").toString()) : 0);
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Customer updated successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Customer not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap deleteCustomer(int customerId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String checkSql = "SELECT COUNT(*) AS count FROM Plant WHERE CustomerID = ? AND IsActive = 1";
            PreparedStatement checkStmt = conn.prepareStatement(checkSql);
            checkStmt.setInt(1, customerId);
            ResultSet rs = checkStmt.executeQuery();
            if (rs.next() && rs.getInt("count") > 0) {
                res.put("status", "error");
                res.put("message", "Cannot delete customer with active plants");
                return res;
            }
            rs.close();
            checkStmt.close();
            
            String sql = "DELETE FROM Customer WHERE CustomerID = ?";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, customerId);
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Customer deleted successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Customer not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== EQUIPMENT MANAGEMENT ====================
    
    public ModelMap getEquipmentByPlant(int plantId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT pe.EquipmentID, e.Specification AS EquipmentName, e.ModelNumber " +
                         "FROM PlantEquipment pe " +
                         "INNER JOIN Equipment e ON pe.EquipmentID = e.EquipmentID " +
                         "WHERE pe.PlantID = ?";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, plantId);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> equipment = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap eq = new ModelMap();
                eq.put("id", rs.getInt("EquipmentID"));
                eq.put("name", rs.getString("EquipmentName"));
                eq.put("model", rs.getString("ModelNumber") != null ? rs.getString("ModelNumber") : "-");
                equipment.add(eq);
            }
            
            res.put("status", "success");
            res.put("equipment", equipment);
            res.put("count", equipment.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getAllEquipmentCategories() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT CategoryID, CategoryName FROM EquipmentCategory ORDER BY CategoryName";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> categories = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap cat = new ModelMap();
                cat.put("id", rs.getInt("CategoryID"));
                cat.put("name", rs.getString("CategoryName"));
                categories.add(cat);
            }
            
            res.put("status", "success");
            res.put("categories", categories);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap createEquipmentCategory(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String sql = "INSERT INTO EquipmentCategory (CategoryID, CategoryName) " +
                        "VALUES ((SELECT ISNULL(MAX(CategoryID), 0) + 1 FROM EquipmentCategory), ?)";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("categoryName") != null ? req.get("categoryName").toString() : "");
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Category created successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Failed to create category");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== ISSUES MANAGEMENT ====================
    
    public ModelMap getIssuesByEquipment(int equipmentId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT ei.IssueID, ei.IssueDesc " +
                         "FROM EquipmentCategoryIssue ei " +
                         "INNER JOIN Equipment e ON e.Category = ei.CategoryID " +
                         "WHERE e.EquipmentID = ? " +
                         "ORDER BY ei.IssueID";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, equipmentId);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> issues = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap issue = new ModelMap();
                issue.put("id", rs.getInt("IssueID"));
                issue.put("name", rs.getString("IssueDesc"));
                issues.add(issue);
            }
            
            res.put("status", "success");
            res.put("issues", issues);
            res.put("count", issues.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getAllIssues() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT IssueID, IssueDesc FROM EquipmentCategoryIssue ORDER BY IssueID";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> issues = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap issue = new ModelMap();
                issue.put("id", rs.getInt("IssueID"));
                issue.put("name", rs.getString("IssueDesc"));
                issues.add(issue);
            }
            
            res.put("status", "success");
            res.put("issues", issues);
            res.put("count", issues.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== EMPLOYEE MANAGEMENT ====================
    
    public ModelMap getAllEmployees() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT e.EmployeeID, e.EmployeeName, e.Phone, e.Email, " +
                        "ed.District, d.DistrictName, e.Role, e.IsActive, " +
                        "dbo.Get_Emp_Service_Pending(e.EmployeeID) AS PendingCount " +
                        "FROM Employee e " +
                        "LEFT JOIN EmployeeDistrict ed ON e.EmployeeID = ed.EmployeeID " +
                        "LEFT JOIN District d ON ed.District = d.DistrictCode " +
                        "WHERE e.IsActive = 1 " +
                        "ORDER BY e.EmployeeName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> employees = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap emp = new ModelMap();
                emp.put("id", rs.getInt("EmployeeID"));
                emp.put("name", rs.getString("EmployeeName"));
                emp.put("phone", rs.getString("Phone"));
                emp.put("email", rs.getString("Email"));
                emp.put("districtCode", rs.getString("District"));
                emp.put("districtName", rs.getString("DistrictName"));
                emp.put("role", rs.getString("Role"));
                emp.put("pendingCount", rs.getInt("PendingCount"));
                employees.add(emp);
            }
            
            res.put("status", "success");
            res.put("employees", employees);
            res.put("count", employees.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getEmployeesByDistrict(String districtCode) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT e.EmployeeID, e.EmployeeName, e.Phone, e.Email, e.Role, " +
                        "dbo.Get_Emp_Service_Pending(e.EmployeeID) AS PendingCount " +
                        "FROM Employee e " +
                        "INNER JOIN EmployeeDistrict ed ON e.EmployeeID = ed.EmployeeID " +
                        "WHERE ed.District = ? AND e.IsActive = 1 AND e.Role IN ('EN', 'TE') " +
                        "ORDER BY e.Role, e.EmployeeName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, districtCode);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> employees = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap emp = new ModelMap();
                emp.put("id", rs.getInt("EmployeeID"));
                emp.put("name", rs.getString("EmployeeName"));
                emp.put("phone", rs.getString("Phone"));
                emp.put("email", rs.getString("Email"));
                emp.put("role", rs.getString("Role"));
                emp.put("pendingCount", rs.getInt("PendingCount"));
                employees.add(emp);
            }
            
            res.put("status", "success");
            res.put("employees", employees);
            res.put("count", employees.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getAvailableEmployees(String districtCode) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT e.EmployeeID, e.EmployeeName, e.Phone, e.Role, " +
                        "dbo.Get_Emp_Service_Pending(e.EmployeeID) AS PendingCount " +
                        "FROM Employee e " +
                        "INNER JOIN EmployeeDistrict ed ON e.EmployeeID = ed.EmployeeID " +
                        "WHERE ed.District = ? AND e.IsActive = 1 AND e.Role IN ('EN', 'TE') " +
                        "AND dbo.Get_Emp_Service_Pending(e.EmployeeID) < 5 " +
                        "ORDER BY e.Role, PendingCount ASC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, districtCode);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> employees = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap emp = new ModelMap();
                emp.put("id", rs.getInt("EmployeeID"));
                emp.put("name", rs.getString("EmployeeName"));
                emp.put("phone", rs.getString("Phone"));
                emp.put("role", rs.getString("Role"));
                emp.put("pendingCount", rs.getInt("PendingCount"));
                employees.add(emp);
            }
            
            res.put("status", "success");
            res.put("employees", employees);
            res.put("count", employees.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getEmployeeById(int empId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT e.*, ed.District, d.DistrictName, s.StateName " +
                        "FROM Employee e " +
                        "LEFT JOIN EmployeeDistrict ed ON e.EmployeeID = ed.EmployeeID " +
                        "LEFT JOIN District d ON ed.District = d.DistrictCode " +
                        "LEFT JOIN State s ON e.StateCode = s.StateCode " +
                        "WHERE e.EmployeeID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, empId);
            ResultSet rs = pstmt.executeQuery();
            
            if (rs.next()) {
                res.put("id", rs.getInt("EmployeeID"));
                res.put("name", rs.getString("EmployeeName"));
                res.put("dateJoin", rs.getString("DateJoin"));
                res.put("address1", rs.getString("Address1"));
                res.put("address2", rs.getString("Address2"));
                res.put("talukName", rs.getString("TalukName"));
                res.put("stateCode", rs.getString("StateCode"));
                res.put("stateName", rs.getString("StateName"));
                res.put("districtCode", rs.getString("District"));
                res.put("districtName", rs.getString("DistrictName"));
                res.put("phone", rs.getString("Phone"));
                res.put("email", rs.getString("Email"));
                res.put("role", rs.getString("Role"));
                res.put("gender", rs.getString("Gender"));
                res.put("isActive", rs.getBoolean("IsActive"));
                res.put("pendingCount", getEmployeePendingCount(empId, conn));
                res.put("status", "success");
            } else {
                res.put("status", "error");
                res.put("message", "Employee not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    private int getEmployeePendingCount(int empId, Connection conn) {
        try {
            String sql = "SELECT dbo.Get_Emp_Service_Pending(?) AS PendingCount";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, empId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt("PendingCount");
            }
        } catch (Exception e) {}
        return 0;
    }
    
    public ModelMap createEmployee(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);
            
            String nextIdSql = "SELECT ISNULL(MAX(EmployeeID), 0) + 1 AS NextID FROM Employee";
            PreparedStatement pstmt = conn.prepareStatement(nextIdSql);
            ResultSet rs = pstmt.executeQuery();
            int nextId = rs.next() ? rs.getInt("NextID") : 1;
            rs.close();
            pstmt.close();
            
            String sql = "INSERT INTO Employee (EmployeeID, EmployeeName, DateJoin, Address1, Address2, " +
                        "TalukName, StateCode, Phone, Email, Role, Gender, Password, IsActive) " +
                        "VALUES (?, ?, GETDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";
            
            pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, nextId);
            pstmt.setString(2, req.get("name") != null ? req.get("name").toString() : "");
            pstmt.setString(3, req.get("address1") != null ? req.get("address1").toString() : "");
            pstmt.setString(4, req.get("address2") != null ? req.get("address2").toString() : "");
            pstmt.setString(5, req.get("talukName") != null ? req.get("talukName").toString() : "");
            pstmt.setString(6, req.get("stateCode") != null ? req.get("stateCode").toString() : "");
            pstmt.setString(7, req.get("phone") != null ? req.get("phone").toString() : "");
            pstmt.setString(8, req.get("email") != null ? req.get("email").toString() : "");
            
            String role = req.get("role") != null ? req.get("role").toString() : "TE";
            pstmt.setString(9, role);
            pstmt.setString(10, req.get("gender") != null ? req.get("gender").toString() : "");
            pstmt.setString(11, req.get("password") != null ? req.get("password").toString() : "default123");
            
            int rows = pstmt.executeUpdate();
            pstmt.close();
            
            // Insert into EmployeeDistrict
            String districtSql = "INSERT INTO EmployeeDistrict (EmployeeID, District, IsAvailable) VALUES (?, ?, 1)";
            pstmt = conn.prepareStatement(districtSql);
            pstmt.setInt(1, nextId);
            pstmt.setString(2, req.get("districtCode") != null ? req.get("districtCode").toString() : "");
            pstmt.executeUpdate();
            pstmt.close();
            
            conn.commit();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Employee created successfully");
                res.put("employeeId", nextId);
            } else {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "Failed to create employee");
            }
            
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (Exception ex) {}
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap updateEmployee(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);
            
            String sql = "UPDATE Employee SET EmployeeName = ?, Address1 = ?, Address2 = ?, " +
                        "TalukName = ?, StateCode = ?, Phone = ?, Email = ?, " +
                        "Role = ?, Gender = ? WHERE EmployeeID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("name") != null ? req.get("name").toString() : "");
            pstmt.setString(2, req.get("address1") != null ? req.get("address1").toString() : "");
            pstmt.setString(3, req.get("address2") != null ? req.get("address2").toString() : "");
            pstmt.setString(4, req.get("talukName") != null ? req.get("talukName").toString() : "");
            pstmt.setString(5, req.get("stateCode") != null ? req.get("stateCode").toString() : "");
            pstmt.setString(6, req.get("phone") != null ? req.get("phone").toString() : "");
            pstmt.setString(7, req.get("email") != null ? req.get("email").toString() : "");
            pstmt.setString(8, req.get("role") != null ? req.get("role").toString() : "TE");
            pstmt.setString(9, req.get("gender") != null ? req.get("gender").toString() : "");
            pstmt.setInt(10, req.get("employeeId") != null ? Integer.parseInt(req.get("employeeId").toString()) : 0);
            
            int rows = pstmt.executeUpdate();
            pstmt.close();
            
            // Update EmployeeDistrict
            if (req.get("districtCode") != null) {
                String districtSql = "UPDATE EmployeeDistrict SET District = ? WHERE EmployeeID = ?";
                pstmt = conn.prepareStatement(districtSql);
                pstmt.setString(1, req.get("districtCode").toString());
                pstmt.setInt(2, req.get("employeeId") != null ? Integer.parseInt(req.get("employeeId").toString()) : 0);
                pstmt.executeUpdate();
                pstmt.close();
            }
            
            conn.commit();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Employee updated successfully");
            } else {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "Employee not found");
            }
            
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (Exception ex) {}
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap deleteEmployee(int empId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);
            
            int pendingCount = getEmployeePendingCount(empId, conn);
            if (pendingCount > 0) {
                res.put("status", "error");
                res.put("message", "Cannot delete employee with " + pendingCount + " pending services");
                return res;
            }
            
            String sql = "UPDATE Employee SET IsActive = 0 WHERE EmployeeID = ?";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, empId);
            int rows = pstmt.executeUpdate();
            pstmt.close();
            
            // Update EmployeeDistrict
            String districtSql = "UPDATE EmployeeDistrict SET IsAvailable = 0 WHERE EmployeeID = ?";
            pstmt = conn.prepareStatement(districtSql);
            pstmt.setInt(1, empId);
            pstmt.executeUpdate();
            pstmt.close();
            
            conn.commit();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Employee deleted successfully");
            } else {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "Employee not found");
            }
            
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (Exception ex) {}
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== SERVICE MANAGEMENT ====================
    
    public ModelMap getPendingServices() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT sr.SRID, sr.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "sr.RequestDate, sr.ProblemDescription, " +
                        "COUNT(srd.SRSlNo) AS EquipmentCount " +
                        "FROM ServiceRequest sr " +
                        "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                        "WHERE sr.Status IN ('O', 'A') " +
                        "GROUP BY sr.SRID, sr.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "sr.RequestDate, sr.ProblemDescription " +
                        "ORDER BY sr.RequestDate ASC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> services = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap service = new ModelMap();
                service.put("srid", rs.getInt("SRID"));
                service.put("plantId", rs.getInt("PlantID"));
                service.put("plantName", rs.getString("PlantName"));
                service.put("district", rs.getString("District"));
                service.put("districtName", rs.getString("DistrictName"));
                service.put("requestDate", rs.getString("RequestDate"));
                service.put("problem", rs.getString("ProblemDescription"));
                service.put("equipmentCount", rs.getInt("EquipmentCount"));
                services.add(service);
            }
            
            res.put("status", "success");
            res.put("services", services);
            res.put("count", services.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getAllServices() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT sr.SRID, sr.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "sr.RequestDate, sr.ServiceDate, sr.Status, " +
                        "COUNT(srd.SRSlNo) AS EquipmentCount, " +
                        "SUM(CASE WHEN srd.ServiceStatus = 'C' THEN 1 ELSE 0 END) AS CompletedCount " +
                        "FROM ServiceRequest sr " +
                        "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                        "GROUP BY sr.SRID, sr.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "sr.RequestDate, sr.ServiceDate, sr.Status " +
                        "ORDER BY sr.SRID DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> services = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap service = new ModelMap();
                service.put("srid", rs.getInt("SRID"));
                service.put("plantId", rs.getInt("PlantID"));
                service.put("plantName", rs.getString("PlantName"));
                service.put("district", rs.getString("District"));
                service.put("districtName", rs.getString("DistrictName"));
                service.put("requestDate", rs.getString("RequestDate"));
                service.put("serviceDate", rs.getString("ServiceDate"));
                service.put("status", rs.getString("Status"));
                service.put("equipmentCount", rs.getInt("EquipmentCount"));
                service.put("completedCount", rs.getInt("CompletedCount"));
                services.add(service);
            }
            
            res.put("status", "success");
            res.put("services", services);
            res.put("count", services.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getServicesByStatus(String status) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT sr.SRID, sr.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "sr.RequestDate, sr.ServiceDate, " +
                        "COUNT(srd.SRSlNo) AS EquipmentCount, " +
                        "SUM(CASE WHEN srd.ServiceStatus = 'C' THEN 1 ELSE 0 END) AS CompletedCount " +
                        "FROM ServiceRequest sr " +
                        "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                        "WHERE sr.Status = ? " +
                        "GROUP BY sr.SRID, sr.PlantID, p.PlantName, p.District, d.DistrictName, " +
                        "sr.RequestDate, sr.ServiceDate " +
                        "ORDER BY sr.SRID DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, status);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> services = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap service = new ModelMap();
                service.put("srid", rs.getInt("SRID"));
                service.put("plantId", rs.getInt("PlantID"));
                service.put("plantName", rs.getString("PlantName"));
                service.put("district", rs.getString("District"));
                service.put("districtName", rs.getString("DistrictName"));
                service.put("requestDate", rs.getString("RequestDate"));
                service.put("serviceDate", rs.getString("ServiceDate"));
                service.put("equipmentCount", rs.getInt("EquipmentCount"));
                service.put("completedCount", rs.getInt("CompletedCount"));
                services.add(service);
            }
            
            res.put("status", "success");
            res.put("services", services);
            res.put("count", services.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getServiceById(int srid) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String sql = "SELECT sr.*, p.PlantName, p.District, d.DistrictName, " +
                        "c.CustomerName, e.EmployeeName AS ReceivedByName " +
                        "FROM ServiceRequest sr " +
                        "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                        "LEFT JOIN District d ON p.District = d.DistrictCode " +
                        "LEFT JOIN Customer c ON p.CustomerID = c.CustomerID " +
                        "LEFT JOIN Employee e ON sr.ReceivedBy = e.EmployeeID " +
                        "WHERE sr.SRID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, srid);
            ResultSet rs = pstmt.executeQuery();
            
            if (rs.next()) {
                res.put("srid", rs.getInt("SRID"));
                res.put("plantId", rs.getInt("PlantID"));
                res.put("plantName", rs.getString("PlantName"));
                res.put("district", rs.getString("District"));
                res.put("districtName", rs.getString("DistrictName"));
                res.put("customerName", rs.getString("CustomerName"));
                res.put("requestDate", rs.getString("RequestDate"));
                res.put("serviceDate", rs.getString("ServiceDate"));
                res.put("serviceRequestStatus", rs.getString("Status"));
                res.put("problem", rs.getString("ProblemDescription"));
                res.put("receivedBy", rs.getString("ReceivedByName"));
            }
            rs.close();
            pstmt.close();
            
            // ✅ FIXED: Get ServiceRate from ServiceTypeMaster via ServiceType
            String eqSql = "SELECT srd.SRSlNo, srd.Equipment, e.Specification AS EquipmentName, " +
                          "e.ModelNumber, srd.ServiceType, st.ServiceTypeName, " +
                          "st.Rate AS ServiceRate, st.UnitOfMeasure AS ServiceUnit, " +  // ✅ Added Rate and Unit
                          "srd.Remarks, srd.ServicedBy, emp.EmployeeName AS ServicedByName, " +
                          "srd.ServiceDate, srd.ServiceStatus, srd.AttachFile, " +
                          "srd.ServiceRate, srd.ServiceUnit, srd.IssueID, ei.IssueDesc " +
                          "FROM ServiceRequestDetail srd " +
                          "LEFT JOIN Equipment e ON srd.Equipment = e.EquipmentID " +
                          "LEFT JOIN ServiceTypeMaster st ON srd.ServiceType = st.ServiceTypeID " +
                          "LEFT JOIN Employee emp ON srd.ServicedBy = emp.EmployeeID " +
                          "LEFT JOIN EquipmentCategoryIssue ei ON srd.IssueID = ei.IssueID " +
                          "WHERE srd.SRID = ? " +
                          "ORDER BY srd.SRSlNo";
            
            pstmt = conn.prepareStatement(eqSql);
            pstmt.setInt(1, srid);
            rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> equipments = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap eq = new ModelMap();
                eq.put("slNo", rs.getInt("SRSlNo"));
                eq.put("equipmentId", rs.getInt("Equipment"));
                eq.put("equipmentName", rs.getString("EquipmentName"));
                eq.put("modelNumber", rs.getString("ModelNumber"));
                eq.put("serviceTypeId", rs.getInt("ServiceType"));
                eq.put("serviceTypeName", rs.getString("ServiceTypeName"));
                eq.put("serviceRate", rs.getBigDecimal("ServiceRate"));  // ✅ From ServiceTypeMaster
                eq.put("serviceUnit", rs.getString("ServiceUnit"));      // ✅ From ServiceTypeMaster
                eq.put("remarks", rs.getString("Remarks"));
                eq.put("servicedById", rs.getInt("ServicedBy"));
                eq.put("servicedByName", rs.getString("ServicedByName"));
                eq.put("serviceDate", rs.getString("ServiceDate"));
                eq.put("status", rs.getString("ServiceStatus"));
                eq.put("attachFile", rs.getString("AttachFile"));
                eq.put("serviceRateCustom", rs.getBigDecimal("ServiceRate")); // Alias for clarity
                eq.put("serviceUnitCustom", rs.getString("ServiceUnit"));
                eq.put("issueId", rs.getInt("IssueID"));
                eq.put("issueName", rs.getString("IssueDesc"));
                
                String partSql = "SELECT sp.PartSlNo, sp.PartID, pm.PartName, sp.Quantity, sp.Rate, sp.Unit " +
                                "FROM ServiceParts sp " +
                                "INNER JOIN PartsMaster pm ON sp.PartID = pm.PartID " +
                                "WHERE sp.SRID = ? AND sp.SRSlNO = ?";
                PreparedStatement partStmt = conn.prepareStatement(partSql);
                partStmt.setInt(1, srid);
                partStmt.setInt(2, rs.getInt("SRSlNo"));
                ResultSet partRs = partStmt.executeQuery();
                
                java.util.ArrayList<ModelMap> parts = new java.util.ArrayList<>();
                while (partRs.next()) {
                    ModelMap part = new ModelMap();
                    part.put("partId", partRs.getInt("PartID"));
                    part.put("partName", partRs.getString("PartName"));
                    part.put("quantity", partRs.getInt("Quantity"));
                    part.put("rate", partRs.getBigDecimal("Rate"));
                    part.put("unit", partRs.getString("Unit"));
                    parts.add(part);
                }
                eq.put("parts", parts);
                partRs.close();
                partStmt.close();
                
                equipments.add(eq);
            }
            res.put("equipments", equipments);
            res.put("status", "success");
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    // ✅ FIXED: Changed ModelMap to Map<String, Object> to accept LinkedHashMap from controller
    public ModelMap createService(Map<String, Object> req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);
            
            String spSql = "{call sp_GetServiceRequestID()}";
            java.sql.CallableStatement cstmt = conn.prepareCall(spSql);
            ResultSet rs = cstmt.executeQuery();
            int srid = rs.next() ? rs.getInt("SRID") : 0;
            rs.close();
            cstmt.close();
            
            if (srid == 0) {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "Failed to generate SRID");
                return res;
            }
            
            String insertSql = "INSERT INTO ServiceRequest (SRID, PlantID, RequestDate, ReceivedBy, Status, ProblemDescription) " +
                              "VALUES (?, ?, GETDATE(), ?, 'O', ?)";
            PreparedStatement pstmt = conn.prepareStatement(insertSql);
            pstmt.setInt(1, srid);
            pstmt.setInt(2, req.get("plantId") != null ? Integer.parseInt(req.get("plantId").toString()) : 0);
            pstmt.setInt(3, req.get("receivedBy") != null ? Integer.parseInt(req.get("receivedBy").toString()) : 1);
            pstmt.setString(4, req.get("problem") != null ? req.get("problem").toString() : "");
            pstmt.executeUpdate();
            pstmt.close();
            
            // Handle equipments list - safely cast from Object
            Object equipmentsObj = req.get("equipments");
            java.util.List<Map<String, Object>> equipments = null;
            
            if (equipmentsObj instanceof java.util.List) {
                equipments = (java.util.List<Map<String, Object>>) equipmentsObj;
            }
            
            int slNo = 1;
            if (equipments != null) {
                for (Map<String, Object> eq : equipments) {
                    String eqSql = "INSERT INTO ServiceRequestDetail (SRID, SRSlNo, Equipment, ServiceType, Remarks, IssueID, ServiceStatus) " +
                                  "VALUES (?, ?, ?, 1, '', ?, 'O')";
                    pstmt = conn.prepareStatement(eqSql);
                    pstmt.setInt(1, srid);
                    pstmt.setInt(2, slNo++);
                    pstmt.setInt(3, eq.get("equipmentId") != null ? Integer.parseInt(eq.get("equipmentId").toString()) : 0);
                    pstmt.setInt(4, eq.get("issueId") != null ? Integer.parseInt(eq.get("issueId").toString()) : 1);
                    pstmt.executeUpdate();
                    pstmt.close();
                }
            }
            
            conn.commit();
            
            res.put("status", "success");
            res.put("message", "Service created successfully");
            res.put("srid", srid);
            
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (Exception ex) {}
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    // ✅ FIXED: Get available employees using EmployeeDistrict table
    public ModelMap getAvailableEmployeesForService(int plantId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            // First get plant district
            String plantSql = "SELECT District FROM Plant WHERE PlantID = ?";
            PreparedStatement pstmt = conn.prepareStatement(plantSql);
            pstmt.setInt(1, plantId);
            ResultSet rs = pstmt.executeQuery();
            String districtCode = rs.next() ? rs.getString("District") : null;
            rs.close();
            pstmt.close();
            
            if (districtCode == null) {
                res.put("status", "error");
                res.put("message", "Plant district not found");
                return res;
            }
            
            // Get available employees from EmployeeDistrict table
            String sql = "SELECT e.EmployeeID, e.EmployeeName, e.Phone, e.Email, e.Role, ed.District, " +
                        "dbo.Get_Emp_Service_Pending(e.EmployeeID) AS PendingCount " +
                        "FROM Employee e " +
                        "INNER JOIN EmployeeDistrict ed ON e.EmployeeID = ed.EmployeeID " +
                        "WHERE ed.District = ? AND ed.IsAvailable = 1 " +
                        "AND e.IsActive = 1 AND e.Role IN ('EN', 'TE') " +
                        "AND dbo.Get_Emp_Service_Pending(e.EmployeeID) < 5 " +
                        "ORDER BY CASE WHEN e.Role = 'EN' THEN 1 ELSE 2 END, PendingCount ASC";
            
            pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, districtCode);
            rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> employees = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap emp = new ModelMap();
                emp.put("id", rs.getInt("EmployeeID"));
                emp.put("name", rs.getString("EmployeeName"));
                emp.put("phone", rs.getString("Phone"));
                emp.put("email", rs.getString("Email"));
                emp.put("role", rs.getString("Role"));
                emp.put("district", rs.getString("District"));
                emp.put("pendingCount", rs.getInt("PendingCount"));
                employees.add(emp);
            }
            
            res.put("status", "success");
            res.put("employees", employees);
            res.put("count", employees.size());
            res.put("district", districtCode);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    // ✅ FIXED: Assign equipment to specific employee (equipment-wise assignment)
    public ModelMap assignEquipment(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);
            
            int srid = req.get("srid") != null ? Integer.parseInt(req.get("srid").toString()) : 0;
            int srSlNo = req.get("srSlNo") != null ? Integer.parseInt(req.get("srSlNo").toString()) : 0;
            int employeeId = req.get("employeeId") != null ? Integer.parseInt(req.get("employeeId").toString()) : 0;
            
            // ✅ Set status to 'P' (Pending/Assigned) - NOT 'A'
            String detailSql = "UPDATE ServiceRequestDetail SET ServicedBy = ?, ServiceStatus = 'P', ServiceDate = GETDATE() WHERE SRID = ? AND SRSlNo = ? AND ServicedBy IS NULL";
            PreparedStatement pstmt = conn.prepareStatement(detailSql);
            pstmt.setInt(1, employeeId);
            pstmt.setInt(2, srid);
            pstmt.setInt(3, srSlNo);
            int detailRows = pstmt.executeUpdate();
            pstmt.close();
            
            // ✅ Check for any equipment still with status 'O' (Open/Not assigned)
            String checkSql = "SELECT COUNT(*) as OpenCount FROM ServiceRequestDetail WHERE SRID = ? AND ServiceStatus = 'O'";
            pstmt = conn.prepareStatement(checkSql);
            pstmt.setInt(1, srid);
            ResultSet rs = pstmt.executeQuery();
            int openCount = rs.next() ? rs.getInt("OpenCount") : 0;
            rs.close();
            pstmt.close();
            
            // ✅ Only if no equipment with 'O', update main status to 'A'
            if (openCount == 0) {
                String statusSql = "UPDATE ServiceRequest SET Status = 'A' WHERE SRID = ?";
                pstmt = conn.prepareStatement(statusSql);
                pstmt.setInt(1, srid);
                pstmt.executeUpdate();
                pstmt.close();
                System.out.println("All equipment assigned - Main status updated to A");
            } else {
                System.out.println("Still " + openCount + " equipment(s) open - Main status remains O");
            }
            
            conn.commit();
            
            if (detailRows > 0) {
                res.put("status", "success");
                res.put("message", "Equipment assigned successfully");
                res.put("srid", srid);
                res.put("srSlNo", srSlNo);
            } else {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "Equipment not found or already assigned");
            }
            
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (Exception ex) {}
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    // ✅ UPDATED: Assign whole service (kept for backward compatibility)
    public ModelMap assignService(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);
            
            int srid = req.get("srid") != null ? Integer.parseInt(req.get("srid").toString()) : 0;
            int employeeId = req.get("employeeId") != null ? Integer.parseInt(req.get("employeeId").toString()) : 0;
            
            // Update all unassigned equipments to this employee
            String detailSql = "UPDATE ServiceRequestDetail SET ServicedBy = ?, ServiceStatus = 'A', ServiceDate = GETDATE() WHERE SRID = ? AND (ServiceStatus = 'O' OR ServiceStatus IS NULL)";
            PreparedStatement pstmt = conn.prepareStatement(detailSql);
            pstmt.setInt(1, employeeId);
            pstmt.setInt(2, srid);
            int detailRows = pstmt.executeUpdate();
            pstmt.close();
            
            // Update ServiceRequest status to 'A' (Assigned)
            String statusSql = "UPDATE ServiceRequest SET Status = 'A' WHERE SRID = ?";
            pstmt = conn.prepareStatement(statusSql);
            pstmt.setInt(1, srid);
            int statusRows = pstmt.executeUpdate();
            pstmt.close();
            
            if (detailRows > 0 && statusRows > 0) {
                conn.commit();
                res.put("status", "success");
                res.put("message", "Service assigned successfully");
                res.put("srid", srid);
            } else if (detailRows == 0) {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "No pending equipments to assign");
            } else {
                conn.rollback();
                res.put("status", "error");
                res.put("message", "Failed to assign service");
            }
            
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (Exception ex) {}
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== PARTS MANAGEMENT ====================
    
    public ModelMap getAllParts() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT p.PartID, p.PartName, p.CategoryID, c.CategoryName, " +
                        "p.Rate, p.Unit, p.Status " +
                        "FROM PartsMaster p " +
                        "LEFT JOIN EquipmentCategory c ON p.CategoryID = c.CategoryID " +
                        "ORDER BY p.PartName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> parts = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap part = new ModelMap();
                part.put("id", rs.getInt("PartID"));
                part.put("name", rs.getString("PartName"));
                part.put("categoryId", rs.getInt("CategoryID"));
                part.put("categoryName", rs.getString("CategoryName"));
                part.put("rate", rs.getBigDecimal("Rate"));
                part.put("unit", rs.getString("Unit"));
                part.put("isActive", rs.getBoolean("Status"));
                parts.add(part);
            }
            
            res.put("status", "success");
            res.put("parts", parts);
            res.put("count", parts.size());
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getPartsByCategory(int categoryId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT PartID, PartName, Rate, Unit FROM PartsMaster " +
                        "WHERE CategoryID = ? AND Status = 1 ORDER BY PartName";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, categoryId);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> parts = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap part = new ModelMap();
                part.put("id", rs.getInt("PartID"));
                part.put("name", rs.getString("PartName"));
                part.put("rate", rs.getBigDecimal("Rate"));
                part.put("unit", rs.getString("Unit"));
                parts.add(part);
            }
            
            res.put("status", "success");
            res.put("parts", parts);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap createPart(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String sql = "INSERT INTO PartsMaster (PartID, PartName, CategoryID, Rate, Unit, Status) " +
                        "VALUES ((SELECT ISNULL(MAX(PartID), 0) + 1 FROM PartsMaster), ?, ?, ?, ?, 1)";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("partName") != null ? req.get("partName").toString() : "");
            pstmt.setInt(2, req.get("categoryId") != null ? Integer.parseInt(req.get("categoryId").toString()) : 0);
            pstmt.setBigDecimal(3, req.get("rate") != null ? new java.math.BigDecimal(req.get("rate").toString()) : java.math.BigDecimal.ZERO);
            pstmt.setString(4, req.get("unit") != null ? req.get("unit").toString() : "Nos");
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Part created successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Failed to create part");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap updatePart(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "UPDATE PartsMaster SET PartName = ?, CategoryID = ?, Rate = ?, Unit = ? " +
                        "WHERE PartID = ?";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("partName") != null ? req.get("partName").toString() : "");
            pstmt.setInt(2, req.get("categoryId") != null ? Integer.parseInt(req.get("categoryId").toString()) : 0);
            pstmt.setBigDecimal(3, req.get("rate") != null ? new java.math.BigDecimal(req.get("rate").toString()) : java.math.BigDecimal.ZERO);
            pstmt.setString(4, req.get("unit") != null ? req.get("unit").toString() : "Nos");
            pstmt.setInt(5, req.get("partId") != null ? Integer.parseInt(req.get("partId").toString()) : 0);
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Part updated successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Part not found");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== SERVICE TYPES ====================
    
    public ModelMap getAllServiceTypes() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT ServiceTypeID, ServiceTypeName, Rate, UnitOfMeasure FROM ServiceTypeMaster ORDER BY ServiceTypeName";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> serviceTypes = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap st = new ModelMap();
                st.put("id", rs.getInt("ServiceTypeID"));
                st.put("name", rs.getString("ServiceTypeName"));
                st.put("rate", rs.getBigDecimal("Rate"));
                st.put("unit", rs.getString("UnitOfMeasure"));
                serviceTypes.add(st);
            }
            
            res.put("status", "success");
            res.put("serviceTypes", serviceTypes);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap createServiceType(ModelMap req) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String sql = "INSERT INTO ServiceTypeMaster (ServiceTypeID, ServiceTypeName, Rate, UnitOfMeasure) " +
                        "VALUES ((SELECT ISNULL(MAX(ServiceTypeID), 0) + 1 FROM ServiceTypeMaster), ?, ?, ?)";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setString(1, req.get("serviceName") != null ? req.get("serviceName").toString() : "");
            pstmt.setBigDecimal(2, req.get("rate") != null ? new java.math.BigDecimal(req.get("rate").toString()) : java.math.BigDecimal.ZERO);
            pstmt.setString(3, req.get("unit") != null ? req.get("unit").toString() : "SERV");
            
            int rows = pstmt.executeUpdate();
            
            if (rows > 0) {
                res.put("status", "success");
                res.put("message", "Service type created successfully");
            } else {
                res.put("status", "error");
                res.put("message", "Failed to create service type");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== DISTRICT & STATE ====================
    
    public ModelMap getAllDistricts() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT DistrictCode, DistrictName, StateCode FROM District ORDER BY DistrictName";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> districts = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap dist = new ModelMap();
                dist.put("code", rs.getString("DistrictCode"));
                dist.put("name", rs.getString("DistrictName"));
                dist.put("stateCode", rs.getString("StateCode"));
                districts.add(dist);
            }
            
            res.put("status", "success");
            res.put("districts", districts);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getAllStates() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT StateCode, StateName FROM State ORDER BY StateName";
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> states = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap state = new ModelMap();
                state.put("code", rs.getString("StateCode"));
                state.put("name", rs.getString("StateName"));
                states.add(state);
            }
            
            res.put("status", "success");
            res.put("states", states);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }

    // ==================== REPORTS ====================
    
    public ModelMap getServiceSummaryReport(String fromDate, String toDate) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            String sql = "SELECT " +
                        "COUNT(*) AS TotalServices, " +
                        "SUM(CASE WHEN Status = 'C' THEN 1 ELSE 0 END) AS Completed, " +
                        "SUM(CASE WHEN Status = 'O' THEN 1 ELSE 0 END) AS Open, " +
                        "SUM(CASE WHEN Status = 'A' THEN 1 ELSE 0 END) AS InProgress " +
                        "FROM ServiceRequest ";
            
            if (fromDate != null && toDate != null) {
                sql += "WHERE RequestDate BETWEEN '" + fromDate + "' AND '" + toDate + "'";
            }
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            if (rs.next()) {
                res.put("total", rs.getInt("TotalServices"));
                res.put("completed", rs.getInt("Completed"));
                res.put("open", rs.getInt("Open"));
                res.put("inProgress", rs.getInt("InProgress"));
            }
            
            res.put("status", "success");
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    public ModelMap getEmployeePerformanceReport() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT e.EmployeeID, e.EmployeeName, ed.District, d.DistrictName, " +
                        "COUNT(srd.SRID) AS TotalServices, " +
                        "SUM(CASE WHEN srd.ServiceStatus = 'C' THEN 1 ELSE 0 END) AS CompletedServices, " +
                        "dbo.Get_Emp_Service_Pending(e.EmployeeID) AS PendingServices " +
                        "FROM Employee e " +
                        "LEFT JOIN EmployeeDistrict ed ON e.EmployeeID = ed.EmployeeID " +
                        "LEFT JOIN ServiceRequestDetail srd ON e.EmployeeID = srd.ServicedBy " +
                        "LEFT JOIN District d ON ed.District = d.DistrictCode " +
                        "WHERE e.IsActive = 1 AND e.Role IN ('EN', 'TE') " +
                        "GROUP BY e.EmployeeID, e.EmployeeName, ed.District, d.DistrictName " +
                        "ORDER BY CompletedServices DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> employees = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap emp = new ModelMap();
                emp.put("id", rs.getInt("EmployeeID"));
                emp.put("name", rs.getString("EmployeeName"));
                emp.put("district", rs.getString("DistrictName"));
                emp.put("total", rs.getInt("TotalServices"));
                emp.put("completed", rs.getInt("CompletedServices"));
                emp.put("pending", rs.getInt("PendingServices"));
                emp.put("completionRate", rs.getInt("TotalServices") > 0 ? 
                        (rs.getInt("CompletedServices") * 100 / rs.getInt("TotalServices")) : 0);
                employees.add(emp);
            }
            
            res.put("status", "success");
            res.put("employees", employees);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
 // ==================== ADD THESE METHODS TO YOUR EXISTING AdminService.java ====================

 // ==================== DASHBOARD ADDITIONAL METHODS ====================

 public ModelMap getPendingTasks() {
	    ModelMap res = new ModelMap();
	    Connection conn = null;
	    
	    try {
	        conn = ConnectionManager.getConnection();
	        
	        // ✅ Open Services (Status = 'O')
	        String openSql = "SELECT COUNT(*) AS count FROM ServiceRequest WHERE Status = 'O'";
	        PreparedStatement pstmt = conn.prepareStatement(openSql);
	        ResultSet rs = pstmt.executeQuery();
	        int openServices = rs.next() ? rs.getInt("count") : 0;
	        rs.close(); pstmt.close();
	        
	        // ✅ Assigned Services (Status = 'A')
	        String assignedSql = "SELECT COUNT(*) AS count FROM ServiceRequest WHERE Status = 'A'";
	        pstmt = conn.prepareStatement(assignedSql);
	        rs = pstmt.executeQuery();
	        int assignedServices = rs.next() ? rs.getInt("count") : 0;
	        rs.close(); pstmt.close();
	        
	        // ✅ Completed Today
	        String completedSql = "SELECT COUNT(*) AS count FROM ServiceRequest WHERE Status = 'C' AND CAST(ServiceDate AS DATE) = CAST(GETDATE() AS DATE)";
	        pstmt = conn.prepareStatement(completedSql);
	        rs = pstmt.executeQuery();
	        int completedToday = rs.next() ? rs.getInt("count") : 0;
	        rs.close(); pstmt.close();
	        
	        res.put("status", "success");
	        res.put("openServices", openServices);
	        res.put("assignedServices", assignedServices);
	        res.put("completedToday", completedToday);
	        
	    } catch (Exception e) {
	        e.printStackTrace();
	        res.put("status", "error");
	        res.put("message", e.getMessage());
	        res.put("openServices", 0);
	        res.put("assignedServices", 0);
	        res.put("completedToday", 0);
	    } finally {
	        try { if (conn != null) conn.close(); } catch (Exception e) {}
	    }
	    return res;
	}
 public ModelMap getDistrictWiseServices() {
	    ModelMap res = new ModelMap();
	    Connection conn = null;
	    
	    try {
	        conn = ConnectionManager.getConnection();
	        String sql = "SELECT ISNULL(d.DistrictName, 'Unknown') AS districtName, COUNT(sr.SRID) AS count " +
	                    "FROM ServiceRequest sr " +
	                    "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
	                    "LEFT JOIN District d ON p.District = d.DistrictCode " +
	                    "GROUP BY d.DistrictName " +
	                    "ORDER BY count DESC";
	        
	        PreparedStatement pstmt = conn.prepareStatement(sql);
	        ResultSet rs = pstmt.executeQuery();
	        
	        List<ModelMap> districts = new ArrayList<>();
	        while (rs.next()) {
	            ModelMap dist = new ModelMap();
	            dist.put("districtName", rs.getString("districtName"));
	            dist.put("count", rs.getInt("count"));
	            districts.add(dist);
	        }
	        
	        res.put("status", "success");
	        res.put("districtWiseServices", districts);  // ✅ Key correct ah irukku
	        // res.put("districts", districts); // Ithu vendam
	        
	    } catch (Exception e) {
	        e.printStackTrace();
	        res.put("status", "error");
	        res.put("message", e.getMessage());
	        res.put("districtWiseServices", new ArrayList<>()); // ✅ Empty list potru
	    }
	    return res;
	}

 public ModelMap getMonthlyRevenue() {
	    ModelMap res = new ModelMap();
	    Connection conn = null;
	    
	    try {
	        conn = ConnectionManager.getConnection();
	        
	        // ✅ Get revenue from ServiceParts with proper date filtering
	        String sql = "SELECT " +
	                    "FORMAT(srd.ServiceDate, 'yyyy-MM') AS monthKey, " +
	                    "FORMAT(srd.ServiceDate, 'MMM yyyy') AS month, " +
	                    "ISNULL(SUM(sp.Quantity * sp.Rate), 0) AS revenue, " +
	                    "COUNT(DISTINCT srd.SRID) AS count " +
	                    "FROM ServiceRequestDetail srd " +
	                    "LEFT JOIN ServiceParts sp ON srd.SRID = sp.SRID AND srd.SRSlNo = sp.SRSlNO " +
	                    "WHERE srd.ServiceStatus = 'C' AND srd.ServiceDate IS NOT NULL " +
	                    "GROUP BY FORMAT(srd.ServiceDate, 'yyyy-MM'), FORMAT(srd.ServiceDate, 'MMM yyyy') " +
	                    "ORDER BY monthKey DESC " +
	                    "OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY";
	        
	        PreparedStatement pstmt = conn.prepareStatement(sql);
	        ResultSet rs = pstmt.executeQuery();
	        
	        List<ModelMap> months = new ArrayList<>();
	        while (rs.next()) {
	            ModelMap month = new ModelMap();
	            month.put("monthKey", rs.getString("monthKey"));
	            month.put("month", rs.getString("month"));
	            month.put("revenue", rs.getDouble("revenue"));
	            month.put("count", rs.getInt("count"));
	            months.add(month);
	            
	            System.out.println("Month: " + rs.getString("month") + ", Revenue: " + rs.getDouble("revenue"));
	        }
	        
	        // Reverse to show chronological order
	        Collections.reverse(months);
	        
	        // If no data from ServiceParts, try ServiceRequestDetail ServiceRate
	        if (months.isEmpty()) {
	            String altSql = "SELECT " +
	                        "FORMAT(ServiceDate, 'yyyy-MM') AS monthKey, " +
	                        "FORMAT(ServiceDate, 'MMM yyyy') AS month, " +
	                        "ISNULL(SUM(ServiceRate), 0) AS revenue, " +
	                        "COUNT(DISTINCT SRID) AS count " +
	                        "FROM ServiceRequestDetail " +
	                        "WHERE ServiceStatus = 'C' AND ServiceDate IS NOT NULL " +
	                        "GROUP BY FORMAT(ServiceDate, 'yyyy-MM'), FORMAT(ServiceDate, 'MMM yyyy') " +
	                        "ORDER BY monthKey DESC " +
	                        "OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY";
	            
	            pstmt = conn.prepareStatement(altSql);
	            rs = pstmt.executeQuery();
	            
	            while (rs.next()) {
	                ModelMap month = new ModelMap();
	                month.put("monthKey", rs.getString("monthKey"));
	                month.put("month", rs.getString("month"));
	                month.put("revenue", rs.getDouble("revenue"));
	                month.put("count", rs.getInt("count"));
	                months.add(month);
	                
	                System.out.println("Alt Month: " + rs.getString("month") + ", Revenue: " + rs.getDouble("revenue"));
	            }
	            Collections.reverse(months);
	        }
	        
	        res.put("status", "success");
	        res.put("months", months);
	        
	    } catch (Exception e) {
	        e.printStackTrace();
	        res.put("status", "error");
	        res.put("message", e.getMessage());
	        res.put("months", new ArrayList<>());
	    } finally {
	        try { if (conn != null) conn.close(); } catch (Exception e) {}
	    }
	    return res;
	}

 public ModelMap getServiceStatusDistribution() {
	    ModelMap res = new ModelMap();
	    Connection conn = null;
	    
	    try {
	        conn = ConnectionManager.getConnection();
	        
	        // ✅ 'open' keyword use panna koodathu - 'open_status' use pannu
	        String sql = "SELECT " +
	                    "SUM(CASE WHEN Status = 'C' THEN 1 ELSE 0 END) AS completed, " +
	                    "SUM(CASE WHEN Status = 'A' THEN 1 ELSE 0 END) AS assigned, " +
	                    "SUM(CASE WHEN Status = 'O' THEN 1 ELSE 0 END) AS open_status " +
	                    "FROM ServiceRequest";
	        
	        PreparedStatement pstmt = conn.prepareStatement(sql);
	        ResultSet rs = pstmt.executeQuery();
	        
	        if (rs.next()) {
	            res.put("completed", rs.getInt("completed"));
	            res.put("assigned", rs.getInt("assigned"));
	            res.put("open", rs.getInt("open_status"));  // Frontend ku 'open' nu podu
	        } else {
	            res.put("completed", 0);
	            res.put("assigned", 0);
	            res.put("open", 0);
	        }
	        
	        res.put("status", "success");
	        
	    } catch (Exception e) {
	        e.printStackTrace();
	        res.put("status", "error");
	        res.put("message", e.getMessage());
	        res.put("completed", 0);
	        res.put("assigned", 0);
	        res.put("open", 0);
	    } finally {
	        try { if (conn != null) conn.close(); } catch (Exception e) {}
	    }
	    return res;
	}
 // ==================== FILTER METHODS FOR CUSTOMERS ====================

 public ModelMap getCustomersByDistrict(String districtCode) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT c.CustomerID, c.CustomerName, c.Phone, c.Email, " +
                     "c.Address1, c.Address2, d.DistrictName, s.StateName, " +
                     "(SELECT COUNT(*) FROM Plant WHERE CustomerID = c.CustomerID AND IsActive = 1) AS plantCount " +
                     "FROM Customer c " +
                     "LEFT JOIN District d ON c.DistrictCode = d.DistrictCode " +
                     "LEFT JOIN State s ON c.StateCode = s.StateCode " +
                     "WHERE c.DistrictCode = ? " +
                     "ORDER BY c.CustomerName";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setString(1, districtCode);
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> customers = new ArrayList<>();
         while (rs.next()) {
             ModelMap customer = new ModelMap();
             customer.put("id", rs.getInt("CustomerID"));
             customer.put("name", rs.getString("CustomerName"));
             customer.put("phone", rs.getString("Phone"));
             customer.put("email", rs.getString("Email"));
             customer.put("address1", rs.getString("Address1"));
             customer.put("address2", rs.getString("Address2"));
             customer.put("districtName", rs.getString("DistrictName"));
             customer.put("stateName", rs.getString("StateName"));
             customer.put("plantCount", rs.getInt("plantCount"));
             customers.add(customer);
         }
         
         res.put("status", "success");
         res.put("customers", customers);
         res.put("count", customers.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 public ModelMap searchCustomers(String keyword) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT c.CustomerID, c.CustomerName, c.Phone, c.Email, " +
                     "c.Address1, c.Address2, d.DistrictName, s.StateName, " +
                     "(SELECT COUNT(*) FROM Plant WHERE CustomerID = c.CustomerID AND IsActive = 1) AS plantCount " +
                     "FROM Customer c " +
                     "LEFT JOIN District d ON c.DistrictCode = d.DistrictCode " +
                     "LEFT JOIN State s ON c.StateCode = s.StateCode " +
                     "WHERE c.CustomerName LIKE ? OR c.Phone LIKE ? OR d.DistrictName LIKE ? " +
                     "ORDER BY c.CustomerName";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         String searchPattern = "%" + keyword + "%";
         pstmt.setString(1, searchPattern);
         pstmt.setString(2, searchPattern);
         pstmt.setString(3, searchPattern);
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> customers = new ArrayList<>();
         while (rs.next()) {
             ModelMap customer = new ModelMap();
             customer.put("id", rs.getInt("CustomerID"));
             customer.put("name", rs.getString("CustomerName"));
             customer.put("phone", rs.getString("Phone"));
             customer.put("email", rs.getString("Email"));
             customer.put("address1", rs.getString("Address1"));
             customer.put("address2", rs.getString("Address2"));
             customer.put("districtName", rs.getString("DistrictName"));
             customer.put("stateName", rs.getString("StateName"));
             customer.put("plantCount", rs.getInt("plantCount"));
             customers.add(customer);
         }
         
         res.put("status", "success");
         res.put("customers", customers);
         res.put("count", customers.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 // ==================== SERVICE FILTER METHODS ====================

 public ModelMap getServicesByDistrictName(String districtName) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT sr.SRID, p.PlantName, c.CustomerName, sr.RequestDate, sr.Status, " +
                     "sr.ProblemDescription " +
                     "FROM ServiceRequest sr " +
                     "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                     "INNER JOIN Customer c ON p.CustomerID = c.CustomerID " +
                     "INNER JOIN District d ON p.District = d.DistrictCode " +
                     "WHERE d.DistrictName = ? " +
                     "ORDER BY sr.SRID DESC";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setString(1, districtName);
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> services = new ArrayList<>();
         while (rs.next()) {
             ModelMap service = new ModelMap();
             service.put("srid", rs.getInt("SRID"));
             service.put("plantName", rs.getString("PlantName"));
             service.put("customerName", rs.getString("CustomerName"));
             service.put("requestDate", rs.getString("RequestDate"));
             service.put("status", rs.getString("Status"));
             service.put("problem", rs.getString("ProblemDescription"));
             services.add(service);
         }
         
         res.put("status", "success");
         res.put("services", services);
         res.put("count", services.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 public ModelMap getServicesByMonthYear(String year, String month) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT sr.SRID, p.PlantName, c.CustomerName, sr.RequestDate, sr.Status, " +
                     "sr.ProblemDescription " +
                     "FROM ServiceRequest sr " +
                     "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                     "INNER JOIN Customer c ON p.CustomerID = c.CustomerID " +
                     "WHERE YEAR(sr.RequestDate) = ? AND MONTH(sr.RequestDate) = ? " +
                     "ORDER BY sr.SRID DESC";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setInt(1, Integer.parseInt(year));
         pstmt.setInt(2, Integer.parseInt(month));
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> services = new ArrayList<>();
         while (rs.next()) {
             ModelMap service = new ModelMap();
             service.put("srid", rs.getInt("SRID"));
             service.put("plantName", rs.getString("PlantName"));
             service.put("customerName", rs.getString("CustomerName"));
             service.put("requestDate", rs.getString("RequestDate"));
             service.put("status", rs.getString("Status"));
             service.put("problem", rs.getString("ProblemDescription"));
             services.add(service);
         }
         
         res.put("status", "success");
         res.put("services", services);
         res.put("count", services.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 public ModelMap getServicesByStatusCode(String statusCode) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT sr.SRID, p.PlantName, c.CustomerName, sr.RequestDate, sr.Status, " +
                     "sr.ProblemDescription " +
                     "FROM ServiceRequest sr " +
                     "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                     "INNER JOIN Customer c ON p.CustomerID = c.CustomerID " +
                     "WHERE sr.Status = ? " +
                     "ORDER BY sr.SRID DESC";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setString(1, statusCode);
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> services = new ArrayList<>();
         while (rs.next()) {
             ModelMap service = new ModelMap();
             service.put("srid", rs.getInt("SRID"));
             service.put("plantName", rs.getString("PlantName"));
             service.put("customerName", rs.getString("CustomerName"));
             service.put("requestDate", rs.getString("RequestDate"));
             service.put("status", rs.getString("Status"));
             service.put("problem", rs.getString("ProblemDescription"));
             services.add(service);
         }
         
         res.put("status", "success");
         res.put("services", services);
         res.put("count", services.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 // ==================== EQUIPMENT ISSUES BY CATEGORY ====================

 public ModelMap getIssuesByCategory(int categoryId) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT IssueID, IssueDesc FROM EquipmentCategoryIssue WHERE CategoryID = ? ORDER BY IssueID";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setInt(1, categoryId);
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> issues = new ArrayList<>();
         while (rs.next()) {
             ModelMap issue = new ModelMap();
             issue.put("id", rs.getInt("IssueID"));
             issue.put("name", rs.getString("IssueDesc"));
             issues.add(issue);
         }
         
         res.put("status", "success");
         res.put("issues", issues);
         res.put("count", issues.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 // ==================== PLANT EQUIPMENT MANAGEMENT ====================

 public ModelMap getPlantEquipmentWithIssues(int plantId) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         String sql = "SELECT pe.EquipmentID, e.Specification AS EquipmentName, e.ModelNumber, " +
                     "e.Category, ec.CategoryName " +
                     "FROM PlantEquipment pe " +
                     "INNER JOIN Equipment e ON pe.EquipmentID = e.EquipmentID " +
                     "LEFT JOIN EquipmentCategory ec ON e.Category = ec.CategoryID " +
                     "WHERE pe.PlantID = ?";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setInt(1, plantId);
         ResultSet rs = pstmt.executeQuery();
         
         List<ModelMap> equipment = new ArrayList<>();
         while (rs.next()) {
             ModelMap eq = new ModelMap();
             eq.put("id", rs.getInt("EquipmentID"));
             eq.put("name", rs.getString("EquipmentName"));
             eq.put("model", rs.getString("ModelNumber"));
             eq.put("categoryId", rs.getInt("Category"));
             eq.put("categoryName", rs.getString("CategoryName"));
             
             // Get issues for this equipment category
             String issueSql = "SELECT IssueID, IssueDesc FROM EquipmentCategoryIssue WHERE CategoryID = ?";
             PreparedStatement issueStmt = conn.prepareStatement(issueSql);
             issueStmt.setInt(1, rs.getInt("Category"));
             ResultSet issueRs = issueStmt.executeQuery();
             
             List<ModelMap> issues = new ArrayList<>();
             while (issueRs.next()) {
                 ModelMap issue = new ModelMap();
                 issue.put("id", issueRs.getInt("IssueID"));
                 issue.put("name", issueRs.getString("IssueDesc"));
                 issues.add(issue);
             }
             eq.put("issues", issues);
             issueRs.close();
             issueStmt.close();
             
             equipment.add(eq);
         }
         
         res.put("status", "success");
         res.put("equipment", equipment);
         res.put("count", equipment.size());
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }

 // ==================== CUSTOMER WITH COMPLETE DETAILS ====================

 public ModelMap getCustomerCompleteDetails(int customerId) {
     ModelMap res = new ModelMap();
     Connection conn = null;
     
     try {
         conn = ConnectionManager.getConnection();
         
         // Customer details
         String sql = "SELECT c.CustomerID, c.CustomerName, c.Phone, c.Email, " +
                     "c.Address1, c.Address2, c.StateCode, c.DistrictCode, " +
                     "d.DistrictName, s.StateName " +
                     "FROM Customer c " +
                     "LEFT JOIN District d ON c.DistrictCode = d.DistrictCode " +
                     "LEFT JOIN State s ON c.StateCode = s.StateCode " +
                     "WHERE c.CustomerID = ?";
         
         PreparedStatement pstmt = conn.prepareStatement(sql);
         pstmt.setInt(1, customerId);
         ResultSet rs = pstmt.executeQuery();
         
         if (rs.next()) {
             res.put("id", rs.getInt("CustomerID"));
             res.put("name", rs.getString("CustomerName"));
             res.put("phone", rs.getString("Phone"));
             res.put("email", rs.getString("Email"));
             res.put("address1", rs.getString("Address1"));
             res.put("address2", rs.getString("Address2"));
             res.put("stateCode", rs.getString("StateCode"));
             res.put("stateName", rs.getString("StateName"));
             res.put("districtCode", rs.getString("DistrictCode"));
             res.put("districtName", rs.getString("DistrictName"));
         }
         rs.close(); pstmt.close();
         
         // Plants with service counts
         String plantSql = "SELECT p.PlantID, p.PlantName, p.District, d.DistrictName, " +
                          "p.PlantCapacity, p.InstalledDate, " +
                          "(SELECT COUNT(*) FROM ServiceRequest WHERE PlantID = p.PlantID) AS serviceCount " +
                          "FROM Plant p " +
                          "LEFT JOIN District d ON p.District = d.DistrictCode " +
                          "WHERE p.CustomerID = ? AND p.IsActive = 1 " +
                          "ORDER BY p.PlantName";
         
         pstmt = conn.prepareStatement(plantSql);
         pstmt.setInt(1, customerId);
         rs = pstmt.executeQuery();
         
         List<ModelMap> plants = new ArrayList<>();
         while (rs.next()) {
             ModelMap plant = new ModelMap();
             plant.put("id", rs.getInt("PlantID"));
             plant.put("name", rs.getString("PlantName"));
             plant.put("district", rs.getString("District"));
             plant.put("districtName", rs.getString("DistrictName"));
             plant.put("capacity", rs.getDouble("PlantCapacity"));
             plant.put("installedDate", rs.getString("InstalledDate"));
             plant.put("serviceCount", rs.getInt("serviceCount"));
             plants.add(plant);
         }
         res.put("plants", plants);
         res.put("status", "success");
         
     } catch (Exception e) {
         e.printStackTrace();
         res.put("status", "error");
         res.put("message", e.getMessage());
     } finally {
         try { if (conn != null) conn.close(); } catch (Exception e) {}
     }
     return res;
 }
    
    public ModelMap getPartsUsageReport(String fromDate, String toDate) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT pm.PartID, pm.PartName, ec.CategoryName, " +
                        "SUM(sp.Quantity) AS TotalQuantity, " +
                        "SUM(sp.Quantity * sp.Rate) AS TotalAmount " +
                        "FROM ServiceParts sp " +
                        "INNER JOIN PartsMaster pm ON sp.PartID = pm.PartID " +
                        "LEFT JOIN EquipmentCategory ec ON pm.CategoryID = ec.CategoryID " +
                        "INNER JOIN ServiceRequestDetail srd ON sp.SRID = srd.SRID AND sp.SRSlNO = srd.SRSlNo " +
                        "WHERE srd.ServiceStatus = 'C' ";
            
            if (fromDate != null && toDate != null) {
                sql += "AND srd.ServiceDate BETWEEN '" + fromDate + "' AND '" + toDate + "'";
            }
            
            sql += "GROUP BY pm.PartID, pm.PartName, ec.CategoryName " +
                   "ORDER BY TotalQuantity DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            java.util.ArrayList<ModelMap> parts = new java.util.ArrayList<>();
            while (rs.next()) {
                ModelMap part = new ModelMap();
                part.put("id", rs.getInt("PartID"));
                part.put("name", rs.getString("PartName"));
                part.put("category", rs.getString("CategoryName"));
                part.put("quantity", rs.getInt("TotalQuantity"));
                part.put("amount", rs.getBigDecimal("TotalAmount"));
                parts.add(part);
            }
            
            res.put("status", "success");
            res.put("parts", parts);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    public ModelMap getCompletedTodayServices() {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT sr.SRID, p.PlantName, c.CustomerName, sr.RequestDate, sr.Status, sr.ProblemDescription " +
                        "FROM ServiceRequest sr " +
                        "INNER JOIN Plant p ON sr.PlantID = p.PlantID " +
                        "INNER JOIN Customer c ON p.CustomerID = c.CustomerID " +
                        "WHERE sr.Status = 'C' AND CAST(sr.ServiceDate AS DATE) = CAST(GETDATE() AS DATE) " +
                        "ORDER BY sr.SRID DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            ResultSet rs = pstmt.executeQuery();
            
            List<ModelMap> services = new ArrayList<>();
            while (rs.next()) {
                ModelMap service = new ModelMap();
                service.put("srid", rs.getInt("SRID"));
                service.put("plantName", rs.getString("PlantName"));
                service.put("customerName", rs.getString("CustomerName"));
                service.put("requestDate", rs.getString("RequestDate"));
                service.put("status", rs.getString("Status"));
                service.put("problem", rs.getString("ProblemDescription"));
                services.add(service);
            }
            
            res.put("status", "success");
            res.put("services", services);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
            res.put("services", new ArrayList<>());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
}