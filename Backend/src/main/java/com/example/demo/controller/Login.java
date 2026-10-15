package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.ui.ModelMap;

import com.example.demo.service.DBLogin;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class Login {

    @PostMapping("/login")
    public ModelMap login(@RequestBody ModelMap req) {

        ModelMap res = new ModelMap();

        try {
            // 🔥 NULL SAFE + TRIM
            String uid = req.get("uid") != null ? req.get("uid").toString().trim() : "";
            String password = req.get("pwd") != null ? req.get("pwd").toString().trim() : "";

            // 🔥 VALIDATION
            if (uid.isEmpty()) {
                res.put("error", "User ID required");
                return res;
            }

            if (password.isEmpty()) {
                res.put("error", "Password required");
                return res;
            }

            // 🔥 CALL SERVICE
            ModelMap result = DBLogin.getLogin(uid, password);

            return result;

        } catch (Exception e) {
            e.printStackTrace();
            res.put("error", "Server error");
            return res;
        }
    }
}