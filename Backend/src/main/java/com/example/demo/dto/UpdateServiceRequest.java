package com.example.demo.dto;

import java.util.List;

public class UpdateServiceRequest {

    private int srid;
    private int equipmentId;
    private String remarks;
    private String status;
    private String file;
    private String serviceTypeId;
    private double serviceRate;
    private String serviceUnit;
    private List<PartDTO> parts;

    // Getters
    public int getSrid() {
        return srid;
    }

    public int getEquipmentId() {
        return equipmentId;
    }

    public String getRemarks() {
        return remarks;
    }

    public String getStatus() {
        return status;
    }

    public String getFile() {
        return file;
    }

    public String getServiceTypeId() {
        return serviceTypeId;
    }

    public double getServiceRate() {
        return serviceRate;
    }

    public String getServiceUnit() {
        return serviceUnit;
    }

    public List<PartDTO> getParts() {
        return parts;
    }

    // Setters
    public void setSrid(int srid) {
        this.srid = srid;
    }

    public void setEquipmentId(int equipmentId) {
        this.equipmentId = equipmentId;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setFile(String file) {
        this.file = file;
    }

    public void setServiceTypeId(String serviceTypeId) {
        this.serviceTypeId = serviceTypeId;
    }

    public void setServiceRate(double serviceRate) {
        this.serviceRate = serviceRate;
    }

    public void setServiceUnit(String serviceUnit) {
        this.serviceUnit = serviceUnit;
    }

    public void setParts(List<PartDTO> parts) {
        this.parts = parts;
    }
}