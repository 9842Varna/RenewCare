package com.example.demo.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.springframework.ui.ModelMap;

import com.example.demo.utils.ConnectionManager;

public class DBLogin {

    public static ModelMap getLogin(String uid, String pwd) {

        Connection conn = null;
        PreparedStatement pStmt = null;
        ResultSet rs = null;

        ModelMap model = new ModelMap();

        try {
            conn = ConnectionManager.getConnection();

            // 🔥 1. CHECK EMPLOYEE FIRST
            String empSql = "SELECT EmployeeID, EmployeeName, Password,Role FROM Employee WHERE EmployeeID = ? AND isActive = 1";

            pStmt = conn.prepareStatement(empSql);
            pStmt.setString(1, uid);

            rs = pStmt.executeQuery();

            if (rs.next()) {

                String dbPassword = rs.getString("Password");

                if (dbPassword != null && dbPassword.equals(pwd)) {

                    model.put("id", rs.getString("EmployeeID"));
                    model.put("name", rs.getString("EmployeeName"));
                    model.put("role", rs.getString("Role"));

                    return model;
                }

                // ❌ DO NOT RETURN → continue to customer
            }

            // 🔥 2. CHECK CUSTOMER
            rs.close();
            pStmt.close();

            String custSql = "SELECT CustomerID, CustomerName, Password FROM Customer WHERE CustomerID = ?";

            pStmt = conn.prepareStatement(custSql);
            pStmt.setString(1, uid);

            rs = pStmt.executeQuery();

            if (rs.next()) {

                String dbPassword = rs.getString("Password");

                if (dbPassword != null && dbPassword.equals(pwd)) {

                    model.put("id", rs.getString("CustomerID"));
                    model.put("name", rs.getString("CustomerName"));

                    return model;
                }

                // ❌ DO NOT RETURN
            }

            // 🔥 3. FINAL ERROR
            model.put("error", "Invalid credentials");

            conn.close();

        } catch (Exception e) {
            e.printStackTrace();
            model.put("error", "Database error");
        }

        return model;
    }
}