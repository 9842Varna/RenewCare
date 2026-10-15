package com.example.demo.utils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

import org.apache.commons.configuration.PropertiesConfiguration;

public class ConnectionManager {

    private static final PropertiesConfiguration properties = PropertiesManager.getInstance().getProperties();

    public static Connection getConnection() throws Exception {
        try {
            Class.forName("net.sourceforge.jtds.jdbc.Driver");

            String url = properties.getString("db.jdbc.url");         
            String username = properties.getString("db.jdbc.username"); 
            String password = properties.getString("db.jdbc.password"); 

            Properties props = new Properties();
            props.setProperty("user", username);
            props.setProperty("password", password);

            // Option 2: use full connection string
            return DriverManager.getConnection(url, username,password);
        } catch (Throwable t) {
            throw new Exception("Unexpected SQLException", t);
        }
    }

    // Optional test method
    public static void main(String[] args) {
        try (Connection conn = getConnection()) {
            System.out.println("Connection successful: " + !conn.isClosed());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
