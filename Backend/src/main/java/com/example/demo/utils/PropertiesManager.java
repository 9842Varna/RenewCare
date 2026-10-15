package com.example.demo.utils;

import org.apache.commons.configuration.PropertiesConfiguration;
import org.apache.commons.configuration.reloading.FileChangedReloadingStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PropertiesManager {

    private static final Logger LOG = LoggerFactory.getLogger(PropertiesManager.class);
    private static final String PROPERTIES_FILE_NAME = "system.properties";
    private static final PropertiesManager singletonInstance = new PropertiesManager();

    private String environment;
    private PropertiesConfiguration properties;

    private PropertiesManager() {
        properties = new PropertiesConfiguration();
        properties.setReloadingStrategy(new FileChangedReloadingStrategy());
        try {
            properties.load(PROPERTIES_FILE_NAME);
        } catch (Exception e) {
            LOG.error("Error loading properties file: {}", PROPERTIES_FILE_NAME, e);
        }
    }

    public static PropertiesManager getInstance() {
        return singletonInstance;
    }

    public PropertiesConfiguration getProperties() {
        return this.properties;
    }

    public String getEnvironment() {
        return environment;
    }
}
