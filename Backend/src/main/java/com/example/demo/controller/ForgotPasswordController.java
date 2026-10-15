package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.ui.ModelMap;
import com.example.demo.service.ForgotPasswordService;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/forgot-password")
public class ForgotPasswordController {
    
    @Autowired
    private ForgotPasswordService forgotPasswordService;
    
    @PostMapping("/send-otp")
    public ModelMap sendOtp(@RequestParam("mobile") String mobile) {
        return forgotPasswordService.sendOtp(mobile);
    }
    
    @PostMapping("/verify-otp")
    public ModelMap verifyOtp(@RequestParam("mobile") String mobile,
                               @RequestParam("otp") String otp) {
        return forgotPasswordService.verifyOtp(mobile, otp);
    }
    
    @PostMapping("/reset")
    public ModelMap resetPassword(@RequestParam("mobile") String mobile,
                                   @RequestParam("otp") String otp,
                                   @RequestParam("newPassword") String newPassword) {
        return forgotPasswordService.resetPassword(mobile, otp, newPassword);
    }
}