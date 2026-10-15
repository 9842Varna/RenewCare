package com.example.demo.service;

import java.sql.*;
import java.text.SimpleDateFormat;
import java.util.*;
import org.springframework.ui.ModelMap;
import com.example.demo.utils.ConnectionManager;

public class DBDashboard {

    // ✅ HELPER METHOD - Parts fetch logic extracted panninom
    // Both branches use pannuvom - duplicate code illa
    private static List<Map<String, Object>> fetchPartsForEquipment(Connection conn, int srid, int srslno) throws SQLException {
        List<Map<String, Object>> partsList = new ArrayList<>();
        
        String partsSql = "SELECT sp.PartID, pm.PartName, sp.Quantity, sp.Rate, sp.Unit " +
                         "FROM ServiceParts sp " +
                         "JOIN PartsMaster pm ON sp.PartID = pm.PartID " +
                         "WHERE sp.SRID = ? AND sp.SRSlNO = ?";
        
        PreparedStatement psParts = conn.prepareStatement(partsSql);
        psParts.setInt(1, srid);
        psParts.setInt(2, srslno);
        ResultSet rsParts = psParts.executeQuery();
        
        while (rsParts.next()) {
            Map<String, Object> p = new HashMap<>();
            p.put("partId", rsParts.getInt("PartID"));
            p.put("partName", rsParts.getString("PartName"));
            p.put("qty", rsParts.getInt("Quantity"));
            p.put("rate", rsParts.getDouble("Rate"));
            p.put("unit", rsParts.getString("Unit"));
            partsList.add(p);
        }
        rsParts.close();
        psParts.close();
        
        return partsList;
    }

    // ✅ HELPER METHOD - Equipment map create pannrom - duplicate avoid panninom
    private static Map<String, Object> buildEquipmentMap(Connection conn, ResultSet rs, int srid) throws SQLException {
        Map<String, Object> eqMap = new HashMap<>();
        
        int eqId      = rs.getInt("EquipmentID");
        String eqName = rs.getString("Specification");
        String model  = rs.getString("ModelNumber");
        
        eqMap.put("id",         eqId);
        eqMap.put("name",       eqName != null ? eqName : "-");
        eqMap.put("model",      model  != null ? model  : "-");
        eqMap.put("categoryId", rs.getInt("Category"));
        eqMap.put("srslno",     rs.getInt("SRSlNO"));  // ✅ இந்த ஒரு line மட்டும் ADD பண்ணுங்க!
        
        String status = rs.getString("ServiceStatus");
        eqMap.put("status", status != null ? status : "A");
        
        String serviceTypeName = rs.getString("ServiceTypeName");
        eqMap.put("serviceTypeName", serviceTypeName != null ? serviceTypeName : "-");
        eqMap.put("serviceRate",     rs.getDouble("ServiceRate"));
        
        String serviceUnit = rs.getString("ServiceUnit");
        eqMap.put("serviceUnit", serviceUnit != null ? serviceUnit : "-");
        
        // Service date format panlam
        Timestamp serviceTimestamp = rs.getTimestamp("ServiceDate");
        String formattedDate = "-";
        if (serviceTimestamp != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy");
            formattedDate = sdf.format(serviceTimestamp);
        }
        eqMap.put("serviceDate", formattedDate);
        
        String attachFile = rs.getString("AttachFile");
        eqMap.put("attachFile", (attachFile != null && attachFile.trim().length() > 0) ? attachFile : "-");
        
        String remarks = rs.getString("Remarks");
        eqMap.put("remarks", (remarks != null && remarks.trim().length() > 0) ? remarks : "-");
        
        // ✅ THE FIX - SRSlNO eduthu parts fetch pannuvom - both branches-um same logic
        int srslno = rs.getInt("SRSlNO");
        eqMap.put("serviceTypeId", rs.getInt("ServiceTypeID") > 0 ? rs.getInt("ServiceTypeID") : null);
        List<Map<String, Object>> parts = fetchPartsForEquipment(conn, srid, srslno);
        eqMap.put("parts", parts); // ✅ Never empty ArrayList - actual DB data
        
        System.out.println("   📦 Equipment: " + eqName + " | SRSlNO: " + srslno + " | Parts found: " + parts.size());
        
        return eqMap;
    }

    public static ModelMap getDashboardData(String empId) {

        ModelMap result = new ModelMap();
        Map<Integer, ModelMap> map = new LinkedHashMap<>();

        try (Connection conn = ConnectionManager.getConnection()) {

            String sql =
                "SELECT " +
                "    sr.SRID, " +
                "    sr.RequestDate, " +
                "    sr.ProblemDescription, " +
                "    p.PlantName, " +
                "    e.Category, " +
                "    e.Specification, " +
                "    e.ModelNumber, " +
                "    e.EquipmentID, " +
                "    srd.ServiceStatus, " +
                "    srd.SRSlNO, " +
                "    srd.ServiceDate, " +
                "    srd.AttachFile, " +
                "    srd.Remarks, " +
                "    srd.ServicedBy, " +
                "    srd.ServiceType AS ServiceTypeID, " + // ✅ ServiceTypeID also select pannrom
                "    st.ServiceTypeName, " +
                "    st.Rate AS ServiceRate, " +
                "    st.UnitOfMeasure AS ServiceUnit " +
                "FROM ServiceRequest sr " +
                "JOIN Plant p ON sr.PlantID = p.PlantID " +
                "LEFT JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                "LEFT JOIN Equipment e ON srd.Equipment = e.EquipmentID " +
                "LEFT JOIN ServiceTypeMaster st ON srd.ServiceType = st.ServiceTypeID " +
                "WHERE srd.ServicedBy = ? " +
                "ORDER BY sr.SRID, srd.SRSlNO";

            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setInt(1, Integer.parseInt(empId));
            ResultSet rs = ps.executeQuery();

            while (rs.next()) {

                int srid      = rs.getInt("SRID");
                String eqName = rs.getString("Specification");
                int eqId      = rs.getInt("EquipmentID");

                // Equipment name valid-a check pannrom
                if (eqName == null || eqName.trim().length() == 0) continue;

                if (map.containsKey(srid)) {
                    // ✅ EXISTING SRID - Equipment already exists-a check pannrom
                    ModelMap row = map.get(srid);
                    List<Map<String, Object>> eqList = (List<Map<String, Object>>) row.get("equipmentList");

                    boolean exists = eqList.stream()
                        .anyMatch(e -> (int) e.get("id") == eqId);

                    if (!exists) {
                        // ✅ New equipment for existing SRID - parts fetch pannuvom (this was working before)
                        Map<String, Object> eqMap = buildEquipmentMap(conn, rs, srid);
                        eqList.add(eqMap);
                    }

                } else {
                    // ✅ BRAND NEW SRID - First equipment create pannrom
                    ModelMap row = new ModelMap();
                    row.put("id", srid);

                    Timestamp requestTimestamp = rs.getTimestamp("RequestDate");
                    String formattedReqDate = "-";
                    if (requestTimestamp != null) {
                        SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy");
                        formattedReqDate = sdf.format(requestTimestamp);
                    }
                    row.put("date", formattedReqDate);

                    String status = rs.getString("ServiceStatus");
                    row.put("status",  status != null ? status : "A");
                    
                    String problem = rs.getString("ProblemDescription");
                    row.put("problem", problem != null ? problem : "-");
                    row.put("plant",   rs.getString("PlantName"));
                    row.put("categoryId", rs.getInt("Category"));

                    List<Map<String, Object>> eqList = new ArrayList<>();

                    // ✅ THE MAIN FIX - buildEquipmentMap use pannrom - parts fetch aagum!
                    // Before: eqMap.put("parts", new ArrayList<>()) - BUG was here!
                    // Now: fetchPartsForEquipment called inside buildEquipmentMap - FIXED!
                    Map<String, Object> eqMap = buildEquipmentMap(conn, rs, srid);
                    eqList.add(eqMap);

                    row.put("equipmentList", eqList);
                    map.put(srid, row);
                }
            }

            result.put("complaints", new ArrayList<>(map.values()));
            System.out.println("✅ Dashboard loaded: " + map.size() + " service requests for empId: " + empId);

        } catch (Exception e) {
            e.printStackTrace();
            result.put("error", e.getMessage());
        }

        return result;
    }

    public static List<Map<String, Object>> getPartsByCategory(int categoryId) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = ConnectionManager.getConnection()) {
            String sql = "SELECT PartID, PartName, Rate, Unit FROM PartsMaster WHERE CategoryID = ? AND Status = 1 ORDER BY PartName";
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setInt(1, categoryId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> m = new HashMap<>();
                m.put("partId",   rs.getInt("PartID"));
                m.put("partName", rs.getString("PartName"));
                m.put("rate",     rs.getDouble("Rate"));
                m.put("unit",     rs.getString("Unit"));
                list.add(m);
            }
            System.out.println("✅ Parts loaded for categoryId " + categoryId + ": " + list.size() + " parts");
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    public static String updateService(
            int srid,
            int equipmentId,
            String remarks,
            String status,
            String file,
            Object serviceTypeIdObj,
            double serviceRate,
            String serviceUnit,
            List<Map<String, Object>> parts) {

        Connection conn     = null;
        PreparedStatement psDetail = null;
        PreparedStatement ps       = null;
        PreparedStatement del      = null;
        PreparedStatement ins      = null;
        PreparedStatement check    = null;
        ResultSet rsDetail = null;
        ResultSet rs       = null;

        try {
            conn = ConnectionManager.getConnection();
            conn.setAutoCommit(false);

            // SRSlNO fetch pannrom
            String detailSql = "SELECT TOP 1 [SRSlNo] AS SRSlNO FROM ServiceRequestDetail WHERE SRID = ? AND Equipment = ?";
            psDetail = conn.prepareStatement(detailSql);
            psDetail.setInt(1, srid);
            psDetail.setInt(2, equipmentId);
            rsDetail = psDetail.executeQuery();

            int srslno = 1;
            if (rsDetail.next()) {
                srslno = rsDetail.getInt("SRSlNO");
            }
            rsDetail.close();
            psDetail.close();

            System.out.println("========================================");
            System.out.println("📝 UPDATING SERVICE");
            System.out.println("   SRID: "          + srid);
            System.out.println("   Equipment ID: "  + equipmentId);
            System.out.println("   SRSlNO: "        + srslno);
            System.out.println("   Service Type: "  + serviceTypeIdObj);
            System.out.println("   Parts count: "   + (parts != null ? parts.size() : 0));

            // ServiceTypeId parse pannrom
            Integer serviceTypeId = null;
            if (serviceTypeIdObj != null) {
                String idStr = serviceTypeIdObj.toString().trim();
                if (idStr.contains(",")) idStr = idStr.split(",")[0].trim();
                try {
                    serviceTypeId = Integer.parseInt(idStr);
                    System.out.println("   ✅ ServiceTypeID: " + serviceTypeId);
                } catch (NumberFormatException e) {
                    System.err.println("   ❌ Parse failed: " + idStr);
                }
            }

            // UOM fetch pannrom
            String finalServiceUnit = "PV";
            if (serviceTypeId != null && serviceTypeId > 0) {
                PreparedStatement psUOM = conn.prepareStatement(
                    "SELECT UnitOfMeasure FROM ServiceTypeMaster WHERE ServiceTypeID = ?");
                psUOM.setInt(1, serviceTypeId);
                ResultSet rsUOM = psUOM.executeQuery();
                if (rsUOM.next()) {
                    finalServiceUnit = rsUOM.getString("UnitOfMeasure");
                    System.out.println("   ✅ UOM: " + finalServiceUnit);
                }
                rsUOM.close();
                psUOM.close();
            }

            // ServiceRequestDetail update pannrom
            String updateSql =
                "UPDATE ServiceRequestDetail SET " +
                "Remarks = ?, ServiceStatus = ?, AttachFile = ?, " +
                "ServiceDate = GETDATE(), ServiceType = ?, ServiceRate = ?, ServiceUnit = ? " +
                "WHERE SRID = ? AND Equipment = ? AND [SRSlNo] = ?";

            ps = conn.prepareStatement(updateSql);
            ps.setString(1, (remarks != null && !remarks.isEmpty()) ? remarks : "");
            ps.setString(2, status != null ? status : "C");
            ps.setString(3, (file   != null && !file.isEmpty())    ? file    : "");

            if (serviceTypeId != null && serviceTypeId > 0) {
                ps.setInt(4, serviceTypeId);
            } else {
                ps.setNull(4, Types.TINYINT);
            }

            ps.setDouble(5, serviceRate);
            ps.setString(6, finalServiceUnit);
            ps.setInt(7, srid);
            ps.setInt(8, equipmentId);
            ps.setInt(9, srslno);

            int updated = ps.executeUpdate();
            System.out.println("   ✅ Rows updated: " + updated);

            // Old parts delete pannrom
            del = conn.prepareStatement("DELETE FROM ServiceParts WHERE SRID = ? AND SRSlNO = ?");
            del.setInt(1, srid);
            del.setInt(2, srslno);
            del.executeUpdate();

            // New parts insert pannrom
            if (parts != null && !parts.isEmpty()) {
                String insertSql =
                    "INSERT INTO ServiceParts (SRID, SRSlNO, PartSlNo, PartID, Quantity, Rate, Unit) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?)";
                ins = conn.prepareStatement(insertSql);
                int partSlNo = 1;

                for (Map<String, Object> p : parts) {
                    int partId = Integer.parseInt(p.get("partId").toString());
                    int qty    = Integer.parseInt(p.get("qty").toString());

                    PreparedStatement psRate = conn.prepareStatement(
                        "SELECT Rate, Unit FROM PartsMaster WHERE PartID = ?");
                    psRate.setInt(1, partId);
                    ResultSet rsRate = psRate.executeQuery();

                    double rate = 0;
                    String unit = "NOS";
                    if (rsRate.next()) {
                        rate = rsRate.getDouble("Rate");
                        unit = rsRate.getString("Unit");
                        if (unit == null || unit.isEmpty()) unit = "NOS";
                    }
                    rsRate.close();
                    psRate.close();

                    ins.setInt(1, srid);
                    ins.setInt(2, srslno);
                    ins.setInt(3, partSlNo++);
                    ins.setInt(4, partId);
                    ins.setInt(5, qty);
                    ins.setDouble(6, rate);
                    ins.setString(7, unit);
                    ins.executeUpdate();
                }
                ins.close();
                System.out.println("   ✅ Parts inserted: " + (partSlNo - 1));
            }

            // All equipment completed-a check pannrom
            String checkSql =
                "SELECT COUNT(*) AS total, " +
                "SUM(CASE WHEN ServiceStatus = 'C' THEN 1 ELSE 0 END) AS completed " +
                "FROM ServiceRequestDetail WHERE SRID = ?";
            check = conn.prepareStatement(checkSql);
            check.setInt(1, srid);
            rs = check.executeQuery();

            if (rs.next()) {
                int total     = rs.getInt("total");
                int completed = rs.getInt("completed");
                System.out.println("   📊 Total: " + total + " | Completed: " + completed);

                if (total == completed && total > 0) {
                    PreparedStatement full = conn.prepareStatement(
                        "UPDATE ServiceRequest SET Status = 'C', ServiceDate = GETDATE() WHERE SRID = ?");
                    full.setInt(1, srid);
                    full.executeUpdate();
                    full.close();
                    System.out.println("   ✅ All equipment done - SR marked complete!");
                }
            }

            conn.commit();
            System.out.println("✅ SERVICE UPDATE SUCCESSFUL! SRID: " + srid);
            return "Success";

        } catch (SQLException e) {
            try { if (conn != null) conn.rollback(); } catch (SQLException ex) {}
            System.err.println("❌ SQL Error: " + e.getMessage());
            e.printStackTrace();
            return "SQL Error: " + e.getMessage();
        } catch (Exception e) {
            try { if (conn != null) conn.rollback(); } catch (SQLException ex) {}
            System.err.println("❌ Error: " + e.getMessage());
            e.printStackTrace();
            return "Error: " + e.getMessage();
        } finally {
            try { if (rsDetail != null) rsDetail.close(); } catch (Exception e) {}
            try { if (rs       != null) rs.close();       } catch (Exception e) {}
            try { if (psDetail != null) psDetail.close(); } catch (Exception e) {}
            try { if (ps       != null) ps.close();       } catch (Exception e) {}
            try { if (del      != null) del.close();      } catch (Exception e) {}
            try { if (ins      != null) ins.close();      } catch (Exception e) {}
            try { if (check    != null) check.close();    } catch (Exception e) {}
            try { if (conn     != null) conn.close();     } catch (Exception e) {}
        }
    }

    public static String deletePart(int srid, int equipmentId, int partId) {
        try (Connection conn = ConnectionManager.getConnection()) {
            System.out.println("🗑️ Deleting part - SRID: " + srid + " | Equipment: " + equipmentId + " | PartID: " + partId);

            PreparedStatement psGet = conn.prepareStatement(
                "SELECT TOP 1 SRSlNO FROM ServiceRequestDetail WHERE SRID = ? AND Equipment = ?");
            psGet.setInt(1, srid);
            psGet.setInt(2, equipmentId);
            ResultSet rs = psGet.executeQuery();

            int srslno = 1;
            if (rs.next()) {
                srslno = rs.getInt("SRSlNO");
            } else {
                System.out.println("❌ No record found for SRID: " + srid);
                return "No record found";
            }
            rs.close();
            psGet.close();

            PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM ServiceParts WHERE SRID = ? AND SRSlNO = ? AND PartID = ?");
            ps.setInt(1, srid);
            ps.setInt(2, srslno);
            ps.setInt(3, partId);
            int rowsDeleted = ps.executeUpdate();

            if (rowsDeleted > 0) {
                System.out.println("✅ Part deleted - PartID: " + partId);
                return "Success";
            } else {
                System.out.println("❌ Part not found - PartID: " + partId);
                return "No part found";
            }

        } catch (Exception e) {
            e.printStackTrace();
            return "Error: " + e.getMessage();
        }
    }

    public static List<Map<String, Object>> getPlantsWithDistrict(String empId) {
        List<Map<String, Object>> plants = new ArrayList<>();

        try (Connection conn = ConnectionManager.getConnection()) {
            String sql =
                "SELECT DISTINCT " +
                "    p.PlantID, p.PlantName, d.DistrictName " +
                "FROM Plant p " +
                "LEFT JOIN District d ON p.District = d.DistrictCode " +
                "JOIN ServiceRequest sr ON p.PlantID = sr.PlantID " +
                "JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                "WHERE srd.ServicedBy = ? " +
                "ORDER BY p.PlantName";

            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setInt(1, Integer.parseInt(empId));
            ResultSet rs = ps.executeQuery();

            while (rs.next()) {
                Map<String, Object> plant = new HashMap<>();
                plant.put("id",   rs.getInt("PlantID"));
                plant.put("name", rs.getString("PlantName"));

                String districtName = rs.getString("DistrictName");
                plant.put("district",
                    (districtName == null || districtName.trim().isEmpty()) ? "Tamil Nadu" : districtName);
                plants.add(plant);
            }

            System.out.println("✅ Plants loaded: " + plants.size() + " for empId: " + empId);

        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("❌ Error loading plants: " + e.getMessage());
        }

        return plants;
    }
 // Get pending services for an employee - Simplified version
 // Get pending services for an employee - Without IssueServiceMapping
    public static List<Map<String, Object>> getEmployeePendingServices(int employeeId) {
        List<Map<String, Object>> pendingList = new ArrayList<>();
        try (Connection conn = ConnectionManager.getConnection()) {
            String sql = 
                "SELECT " +
                "    p.PlantName, " +
                "    e.Specification AS EquipmentName, " +
                "    srd.SRID, " +
                "    COALESCE(srd.Remarks, '-') AS IssueName " +
                "FROM ServiceRequest sr " +
                "JOIN Plant p ON sr.PlantID = p.PlantID " +
                "JOIN ServiceRequestDetail srd ON sr.SRID = srd.SRID " +
                "JOIN Equipment e ON srd.Equipment = e.EquipmentID " +
                "WHERE srd.ServicedBy = ? " +
                "AND srd.ServiceStatus != 'C' " +
                "ORDER BY sr.SRID DESC";
            
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setInt(1, employeeId);
            ResultSet rs = ps.executeQuery();
            
            while (rs.next()) {
                Map<String, Object> pending = new HashMap<>();
                pending.put("plantName", rs.getString("PlantName"));
                pending.put("equipmentName", rs.getString("EquipmentName"));
                pending.put("issueName", rs.getString("IssueName") != null ? rs.getString("IssueName") : "Pending");
                pending.put("srid", rs.getInt("SRID"));
                pendingList.add(pending);
            }
            System.out.println("✅ Pending services loaded for employee: " + employeeId + " - " + pendingList.size() + " records");
        } catch (Exception e) {
            e.printStackTrace();
        }
        return pendingList;
    }
}