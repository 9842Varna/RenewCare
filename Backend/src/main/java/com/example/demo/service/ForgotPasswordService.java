package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.ui.ModelMap;
import java.sql.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.Random;
import com.example.demo.utils.ConnectionManager;

@Service
public class ForgotPasswordService {
    
    // Store OTP temporarily
    private final Map<String, String> otpStore = new ConcurrentHashMap<>();
    private final Map<String, Long> otpExpiry = new ConcurrentHashMap<>();
    
    // Step 1: Send OTP to mobile
    public ModelMap sendOtp(String mobile) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            conn = ConnectionManager.getConnection();
            
            // Check if mobile exists in Employee table
            String empSql = "SELECT EmployeeID, EmployeeName, Role, 'Employee' as UserType FROM Employee WHERE Phone = ? AND IsActive = 1";
            PreparedStatement pstmt = conn.prepareStatement(empSql);
            pstmt.setString(1, mobile);
            ResultSet rs = pstmt.executeQuery();
            
            String userId = null;
            String userName = null;
            String userType = null;
            String role = null;
            
            if (rs.next()) {
                userId = String.valueOf(rs.getInt("EmployeeID"));
                userName = rs.getString("EmployeeName");
                userType = "Employee";
                role = rs.getString("Role");
            }
            rs.close();
            pstmt.close();
            
            // If not found in Employee, check Customer table
            if (userName == null) {
                String custSql = "SELECT CustomerID, CustomerName, 'Customer' as UserType FROM Customer WHERE Phone = ?";
                pstmt = conn.prepareStatement(custSql);
                pstmt.setString(1, mobile);
                rs = pstmt.executeQuery();
                
                if (rs.next()) {
                    userId = String.valueOf(rs.getInt("CustomerID"));
                    userName = rs.getString("CustomerName");
                    userType = "Customer";
                    role = "Customer";
                }
                rs.close();
                pstmt.close();
            }
            
            if (userName == null) {
                res.put("status", "error");
                res.put("message", "Mobile number not registered");
                return res;
            }
            
            // Generate 6-digit OTP
            String otp = String.format("%06d", new Random().nextInt(999999));
            
            // Store OTP (valid for 5 minutes)
            otpStore.put(mobile, otp);
            otpExpiry.put(mobile, System.currentTimeMillis() + 5 * 60 * 1000);
            
            // For testing - print OTP to console
            System.out.println("========================================");
            System.out.println("OTP for " + mobile + " is: " + otp);
            System.out.println("User: " + userName + " (" + userType + ")");
            System.out.println("========================================");
            
            res.put("status", "success");
            res.put("message", "OTP sent successfully");
            res.put("userName", userName);
            res.put("userType", userType);
            res.put("role", role);
            
        } catch (Exception e) {
            e.printStackTrace();
            res.put("status", "error");
            res.put("message", e.getMessage());
        } finally {
            try { if (conn != null) conn.close(); } catch (Exception e) {}
        }
        return res;
    }
    
    // Step 2: Verify OTP
    public ModelMap verifyOtp(String mobile, String otp) {
        ModelMap res = new ModelMap();
        
        try {
            String storedOtp = otpStore.get(mobile);
            Long expiry = otpExpiry.get(mobile);
            
            if (storedOtp == null) {
                res.put("status", "error");
                res.put("message", "OTP not found. Please request new OTP");
                return res;
            }
            
            if (System.currentTimeMillis() > expiry) {
                otpStore.remove(mobile);
                otpExpiry.remove(mobile);
                res.put("status", "error");
                res.put("message", "OTP expired. Please request new OTP");
                return res;
            }
            
            if (!storedOtp.equals(otp)) {
                res.put("status", "error");
                res.put("message", "Invalid OTP. Please try again");
                return res;
            }
            
            // Mark as verified
            otpStore.put(mobile, "VERIFIED");
            
            res.put("status", "success");
            res.put("message", "OTP verified successfully");
            
        } catch (Exception e) {
            res.put("status", "error");
            res.put("message", e.getMessage());
        }
        return res;
    }
    
    // Step 3: Reset password
    public ModelMap resetPassword(String mobile, String otp, String newPassword) {
        ModelMap res = new ModelMap();
        Connection conn = null;
        
        try {
            String status = otpStore.get(mobile);
            
            if (!"VERIFIED".equals(status)) {
                res.put("status", "error");
                res.put("message", "OTP not verified. Please verify OTP first");
                return res;
            }
            
            if (newPassword == null || newPassword.length() < 4) {
                res.put("status", "error");
                res.put("message", "Password must be at least 4 characters");
                return res;
            }
            
            conn = ConnectionManager.getConnection();
            int rows = 0;
            
            // Try to update in Employee table
            String empSql = "UPDATE Employee SET Password = ? WHERE Phone = ? AND IsActive = 1";
            PreparedStatement pstmt = conn.prepareStatement(empSql);
            pstmt.setString(1, newPassword);
            pstmt.setString(2, mobile);
            rows = pstmt.executeUpdate();
            
            // If not in Employee, try Customer table
            if (rows == 0) {
                String custSql = "UPDATE Customer SET Password = ? WHERE Phone = ?";
                pstmt = conn.prepareStatement(custSql);
                pstmt.setString(1, newPassword);
                pstmt.setString(2, mobile);
                rows = pstmt.executeUpdate();
            }
            
            if (rows > 0) {
                // Clear OTP data
                otpStore.remove(mobile);
                otpExpiry.remove(mobile);
                
                res.put("status", "success");
                res.put("message", "Password reset successfully. Please login with new password");
            } else {
                res.put("status", "error");
                res.put("message", "Failed to reset password");
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
}