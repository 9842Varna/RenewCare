package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.ui.ModelMap;
import com.example.demo.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.*;
import java.sql.*;
import com.example.demo.utils.ConnectionManager;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    // ==================== DASHBOARD ====================
    
    @GetMapping("/dashboard/stats")
    public ModelMap getDashboardStats() {
        return adminService.getDashboardStats();
    }

    // ==================== PLANT MANAGEMENT ====================
    
    @GetMapping("/plants")
    public ModelMap getAllPlants() {
        return adminService.getAllPlants();
    }
    
    @GetMapping("/plants/{plantId}")
    public ModelMap getPlantById(@PathVariable("plantId") int plantId) {
        return adminService.getPlantById(plantId);
    }
    
    @GetMapping("/plants/by-customer/{customerId}")
    public ModelMap getPlantsByCustomer(@PathVariable("customerId") int customerId) {
        return adminService.getPlantsByCustomer(customerId);
    }
    
    @PostMapping("/plant/create")
    public ModelMap createPlant(@RequestBody ModelMap req) {
        return adminService.createPlant(req);
    }
    
    @PutMapping("/plant/update")
    public ModelMap updatePlant(@RequestBody ModelMap req) {
        return adminService.updatePlant(req);
    }
    
    @DeleteMapping("/plant/delete/{plantId}")
    public ModelMap deletePlant(@PathVariable("plantId") int plantId) {
        return adminService.deletePlant(plantId);
    }

    // ==================== CUSTOMER MANAGEMENT ====================
    
    @GetMapping("/customers")
    public ModelMap getAllCustomers() {
        return adminService.getAllCustomers();
    }
    
    @GetMapping("/customers/{customerId}")
    public ModelMap getCustomerById(@PathVariable("customerId") int customerId) {
        return adminService.getCustomerById(customerId);
    }
    
    @PostMapping("/customer/create")
    public ModelMap createCustomer(@RequestBody ModelMap req) {
        return adminService.createCustomer(req);
    }
    
    @PutMapping("/customer/update")
    public ModelMap updateCustomer(@RequestBody ModelMap req) {
        return adminService.updateCustomer(req);
    }
    
    @DeleteMapping("/customer/delete/{customerId}")
    public ModelMap deleteCustomer(@PathVariable("customerId") int customerId) {
        return adminService.deleteCustomer(customerId);
    }

    // ==================== EQUIPMENT MANAGEMENT ====================
    
    @GetMapping("/equipment/by-plant/{plantId}")
    public ModelMap getEquipmentByPlant(@PathVariable("plantId") int plantId) {
        return adminService.getEquipmentByPlant(plantId);
    }
    
    @GetMapping("/equipment/categories")
    public ModelMap getAllEquipmentCategories() {
        return adminService.getAllEquipmentCategories();
    }
    
    @PostMapping("/equipment/category/create")
    public ModelMap createEquipmentCategory(@RequestBody ModelMap req) {
        return adminService.createEquipmentCategory(req);
    }

    // ==================== ISSUES MANAGEMENT ====================
    
    @GetMapping("/issues")
    public ModelMap getAllIssues() {
        return adminService.getAllIssues();
    }
    
    @GetMapping("/issues/by-equipment/{equipmentId}")
    public ModelMap getIssuesByEquipment(@PathVariable("equipmentId") int equipmentId) {
        return adminService.getIssuesByEquipment(equipmentId);
    }

    // ==================== EMPLOYEE MANAGEMENT ====================
    
    @GetMapping("/employees")
    public ModelMap getAllEmployees() {
        return adminService.getAllEmployees();
    }
    
    @GetMapping("/employees/by-district/{districtCode}")
    public ModelMap getEmployeesByDistrict(@PathVariable("districtCode") String districtCode) {
        return adminService.getEmployeesByDistrict(districtCode);
    }
    
    @GetMapping("/employees/available/{districtCode}")
    public ModelMap getAvailableEmployees(@PathVariable("districtCode") String districtCode) {
        return adminService.getAvailableEmployees(districtCode);
    }
    
    @GetMapping("/employees/{empId}")
    public ModelMap getEmployeeById(@PathVariable("empId") int empId) {
        return adminService.getEmployeeById(empId);
    }
    
    @PostMapping("/employee/create")
    public ModelMap createEmployee(@RequestBody ModelMap req) {
        return adminService.createEmployee(req);
    }
    
    @PutMapping("/employee/update")
    public ModelMap updateEmployee(@RequestBody ModelMap req) {
        return adminService.updateEmployee(req);
    }
    
    @DeleteMapping("/employee/delete/{empId}")
    public ModelMap deleteEmployee(@PathVariable("empId") int empId) {
        return adminService.deleteEmployee(empId);
    }

    // ==================== SERVICE MANAGEMENT ====================
    
    @GetMapping("/services/pending")
    public ModelMap getPendingServices() {
        return adminService.getPendingServices();
    }
    
    @GetMapping("/services/all")
    public ModelMap getAllServices() {
        return adminService.getAllServices();
    }
    
    @GetMapping("/services/by-status/{status}")
    public ModelMap getServicesByStatus(@PathVariable("status") String status) {
        return adminService.getServicesByStatus(status);
    }
    
    @GetMapping("/services/{srid}")
    public ModelMap getServiceById(@PathVariable("srid") int srid) {
        return adminService.getServiceById(srid);
    }
    
    // ✅ NEW - Get services by plant (FOR ADMIN PLANTS SCREEN)
    @GetMapping("/services/by-plant/{plantId}")
    public ModelMap getServicesByPlant(@PathVariable("plantId") int plantId) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            String sql = "SELECT sr.SRID, sr.RequestDate, sr.Status, sr.ProblemDescription, " +
                        "COUNT(srd.SRSlNo) as EquipmentCount " +
                        "FROM ServiceRequest sr " +
                        "LEFT JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                        "WHERE sr.PlantID = ? " +
                        "GROUP BY sr.SRID, sr.RequestDate, sr.Status, sr.ProblemDescription " +
                        "ORDER BY sr.SRID DESC";
            
            PreparedStatement pstmt = conn.prepareStatement(sql);
            pstmt.setInt(1, plantId);
            ResultSet rs = pstmt.executeQuery();
            
            List<ModelMap> services = new ArrayList<>();
            while (rs.next()) {
                ModelMap service = new ModelMap();
                service.put("srid", rs.getInt("SRID"));
                service.put("requestDate", rs.getString("RequestDate"));
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
    
    // ✅ NEW - Get available employees for a specific service by plantId
    @GetMapping("/services/available-employees/{plantId}")
    public ModelMap getAvailableEmployeesForService(@PathVariable("plantId") int plantId) {
        return adminService.getAvailableEmployeesForService(plantId);
    }
    
    // ✅ FIXED - Changed ModelMap to Map<String, Object>
    @PostMapping("/service/create")
    public ModelMap createService(@RequestBody Map<String, Object> req) {
        return adminService.createService(req);
    }
    
    // ✅ UPDATED - Assign whole service (updates all equipments)
    @PostMapping("/service/assign")
    public ModelMap assignService(@RequestBody ModelMap req) {
        return adminService.assignService(req);
    }
    
    // ✅ NEW - Assign single equipment to employee (equipment-wise assignment)
    @PostMapping("/service/assign-equipment")
    public ModelMap assignEquipment(@RequestBody ModelMap req) {
        return adminService.assignEquipment(req);
    }

    // ==================== PARTS MANAGEMENT ====================
    
    @GetMapping("/parts")
    public ModelMap getAllParts() {
        return adminService.getAllParts();
    }
    
    @GetMapping("/parts/by-category/{categoryId}")
    public ModelMap getPartsByCategory(@PathVariable("categoryId") int categoryId) {
        return adminService.getPartsByCategory(categoryId);
    }
    
    @PostMapping("/part/create")
    public ModelMap createPart(@RequestBody ModelMap req) {
        return adminService.createPart(req);
    }
    
    @PutMapping("/part/update")
    public ModelMap updatePart(@RequestBody ModelMap req) {
        return adminService.updatePart(req);
    }

    // ==================== SERVICE TYPES ====================
    
    @GetMapping("/service-types")
    public ModelMap getAllServiceTypes() {
        return adminService.getAllServiceTypes();
    }
    
    @PostMapping("/service-type/create")
    public ModelMap createServiceType(@RequestBody ModelMap req) {
        return adminService.createServiceType(req);
    }

    // ==================== DISTRICT & STATE ====================
    
    @GetMapping("/districts")
    public ModelMap getAllDistricts() {
        return adminService.getAllDistricts();
    }
    
    @GetMapping("/states")
    public ModelMap getAllStates() {
        return adminService.getAllStates();
    }

    // ==================== REPORTS ====================
    
    @GetMapping("/reports/service-summary")
    public ModelMap getServiceSummaryReport(@RequestParam(value = "fromDate", required = false) String fromDate,
                                             @RequestParam(value = "toDate", required = false) String toDate) {
        return adminService.getServiceSummaryReport(fromDate, toDate);
    }
    
    @GetMapping("/reports/employee-performance")
    public ModelMap getEmployeePerformanceReport() {
        return adminService.getEmployeePerformanceReport();
    }
    
    @GetMapping("/reports/parts-usage")
    public ModelMap getPartsUsageReport(@RequestParam(value = "fromDate", required = false) String fromDate,
                                         @RequestParam(value = "toDate", required = false) String toDate) {
        return adminService.getPartsUsageReport(fromDate, toDate);
    }
    
    // ==================== DASHBOARD ADDITIONAL METHODS ====================

    @GetMapping("/services/completed-today")
    public ModelMap getCompletedTodayServices() {
        return adminService.getCompletedTodayServices();
    }

    @GetMapping("/dashboard/pending-tasks")
    public ModelMap getPendingTasks() {
        return adminService.getPendingTasks();
    }

    @GetMapping("/dashboard/district-wise-services")
    public ModelMap getDistrictWiseServices() {
        return adminService.getDistrictWiseServices();
    }

    @GetMapping("/dashboard/monthly-revenue")
    public ModelMap getMonthlyRevenue() {
        return adminService.getMonthlyRevenue();
    }

    @GetMapping("/dashboard/service-status")
    public ModelMap getServiceStatusDistribution() {
        return adminService.getServiceStatusDistribution();
    }

    // ==================== CUSTOMER FILTER METHODS ====================

    @GetMapping("/customers/by-district/{districtCode}")
    public ModelMap getCustomersByDistrict(@PathVariable("districtCode") String districtCode) {
        return adminService.getCustomersByDistrict(districtCode);
    }
    
    @GetMapping("/customers/search")
    public ModelMap searchCustomers(@RequestParam("keyword") String keyword) {
        return adminService.searchCustomers(keyword);
    }

    @GetMapping("/customers/complete-details/{customerId}")
    public ModelMap getCustomerCompleteDetails(@PathVariable("customerId") int customerId) {
        return adminService.getCustomerCompleteDetails(customerId);
    }
    

    // ==================== SERVICE FILTER METHODS ====================

    @GetMapping("/services/by-district/{districtName}")
    public ModelMap getServicesByDistrictName(@PathVariable("districtName") String districtName) {
        return adminService.getServicesByDistrictName(districtName);
    }

    @GetMapping("/services/by-month")
    public ModelMap getServicesByMonthYear(@RequestParam("year") String year, 
                                            @RequestParam("month") String month) {
        return adminService.getServicesByMonthYear(year, month);
    }

    @GetMapping("/services/by-status-code/{statusCode}")
    public ModelMap getServicesByStatusCode(@PathVariable("statusCode") String statusCode) {
        return adminService.getServicesByStatusCode(statusCode);
    }

    // ==================== EQUIPMENT ADDITIONAL METHODS ====================

    @GetMapping("/equipment/issues/by-category/{categoryId}")
    public ModelMap getIssuesByCategory(@PathVariable("categoryId") int categoryId) {
        return adminService.getIssuesByCategory(categoryId);
    }

    @GetMapping("/equipment/plant-equipment/{plantId}")
    public ModelMap getPlantEquipmentWithIssues(@PathVariable("plantId") int plantId) {
        return adminService.getPlantEquipmentWithIssues(plantId);
    }
    
}