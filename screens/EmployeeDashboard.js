import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE = 'http://192.168.29.223:2927/api';
//const API_URL = "http://10.196.32.8:2927/api/login";
const { width, height } = Dimensions.get('window');

export default function EmployeeDashboardScreen({ user, onLogout, hideHeader = true }) {
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(['assigned', 'pending']);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeId, setEmployeeId] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [viewingPlant, setViewingPlant] = useState(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [groupedPlants, setGroupedPlants] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [expandedPlants, setExpandedPlants] = useState({});
  const [expandedServices, setExpandedServices] = useState({});
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [tempDate, setTempDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFilterActive, setDateFilterActive] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState('');
  const [allPlantNames, setAllPlantNames] = useState([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  useEffect(() => {
    loadEmployeeData();
  }, []);

  useEffect(() => {
    filterAndSortServices();
  }, [serviceRequests, selectedStatuses, searchQuery, selectedDate, selectedPlant]);

  useEffect(() => {
    if (employeeId) {
      const interval = setInterval(() => {
        checkForNewAssignments();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [employeeId]);

  const loadEmployeeData = async () => {
    try {
      let empId = employeeId;
      if (!empId) {
        const empData = await AsyncStorage.getItem('employeeData');
        if (empData) {
          const data = JSON.parse(empData);
          empId = data.id;
          setEmployeeId(empId);
        } else if (user) {
          empId = user.id;
          setEmployeeId(empId);
        }
      }
      if (empId) await fetchDashboard(empId);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const checkForNewAssignments = async () => {
    if (!employeeId) return;
    
    try {
      const response = await axios.get(`${API_BASE}/dashboard/${employeeId}`);
      if (response.data && response.data.complaints) {
        const services = response.data.complaints;
        setServiceRequests(services);
        
        const uniquePlants = [...new Set(services.map(service => service.plant).filter(Boolean))];
        setAllPlantNames(uniquePlants);
      }
    } catch (error) {
      console.error('Auto refresh error:', error);
    }
  };

  const fetchDashboard = async (empId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/dashboard/${empId}`);
      if (response.data && response.data.complaints) {
        const sorted = response.data.complaints.sort((a, b) => {
          const dateA = a.date?.split('/').reverse().join('-') || '';
          const dateB = b.date?.split('/').reverse().join('-') || '';
          return new Date(dateB) - new Date(dateA);
        });
        setServiceRequests(sorted);
        
        const uniquePlants = [...new Set(sorted.map(s => s.plant).filter(Boolean))];
        setAllPlantNames(uniquePlants);
      } else {
        setServiceRequests([]);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusPriority = (service) => {
    const equipmentList = service.equipmentList || [];
    const total = equipmentList.length;
    const completed = equipmentList.filter(eq => eq.status === 'C').length;
    if (total === 0) return 1;
    if (completed === 0) return 2;
    if (completed > 0 && completed < total) return 3;
    return 4;
  };

  const filterAndSortServices = () => {
    let filtered = [...serviceRequests];

    if (!selectedStatuses.includes('all')) {
      filtered = filtered.filter(req => {
        const equipmentList = req.equipmentList || [];
        if (equipmentList.length === 0) return false;
        const total = equipmentList.length;
        const completed = equipmentList.filter(eq => eq.status === 'C').length;
        return (
          (selectedStatuses.includes('assigned') && completed === 0) ||
          (selectedStatuses.includes('pending') && completed > 0 && completed < total) ||
          (selectedStatuses.includes('completed') && completed === total)
        );
      });
    }

    if (selectedDate) {
      filtered = filtered.filter(req => {
        const reqDate = req.date;
        if (!reqDate || reqDate === 'N/A') return false;
        return reqDate === selectedDate;
      });
    }

    if (selectedPlant && selectedPlant !== 'all') {
      filtered = filtered.filter(req => req.plant === selectedPlant);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req =>
        req.plant?.toLowerCase().includes(query) ||
        req.id?.toString().includes(query)
      );
    }

    const sorted = filtered.sort((a, b) => {
      const dateA = a.date?.split('/').reverse().join('-') || '';
      const dateB = b.date?.split('/').reverse().join('-') || '';
      const dateCompare = new Date(dateB) - new Date(dateA);
      if (dateCompare !== 0) return dateCompare;
      return getStatusPriority(a) - getStatusPriority(b);
    });

    const grouped = groupServicesByPlant(sorted);
    setGroupedPlants(grouped);
  };

  const groupServicesByPlant = (services) => {
    const plantMap = new Map();
    services.forEach(service => {
      const plantName = service.plant;
      if (!plantName) return;
      if (!plantMap.has(plantName)) {
        plantMap.set(plantName, {
          plantName: plantName,
          services: [],
          totalServices: 0,
          completedCount: 0,
          pendingCount: 0,
          inProgressCount: 0
        });
      }
      const plant = plantMap.get(plantName);
      const serviceCopy = JSON.parse(JSON.stringify(service));
      plant.services.push(serviceCopy);
      plant.totalServices++;
      const equipmentList = service.equipmentList || [];
      const totalEquipment = equipmentList.length;
      const completedEquipment = equipmentList.filter(eq => eq.status === 'C').length;
      if (totalEquipment > 0 && completedEquipment === 0) plant.pendingCount++;
      else if (totalEquipment > 0 && completedEquipment > 0 && completedEquipment < totalEquipment) plant.inProgressCount++;
      else if (totalEquipment > 0 && completedEquipment === totalEquipment) plant.completedCount++;
    });
    return Array.from(plantMap.values());
  };

  const getPlantOverallStatus = (plant) => {
    if (plant.pendingCount > 0) return { text: 'Pending', color: '#FF9800' };
    if (plant.inProgressCount > 0) return { text: 'In Progress', color: '#4CAF50' };
    if (plant.completedCount === plant.totalServices && plant.totalServices > 0) return { text: 'Completed', color: '#EF4444' };
    return { text: 'No Services', color: '#9E9E9E' };
  };

  const getPlantLastServicedDate = (services) => {
    if (!services || services.length === 0) return null;
    let latestDate = null;
    services.forEach(service => {
      if (service.equipmentList && service.equipmentList.length > 0) {
        service.equipmentList.forEach(eq => {
          if (eq.status === 'C' && eq.serviceDate && eq.serviceDate !== '-') {
            const parts = eq.serviceDate.split('/');
            if (parts.length === 3) {
              const currentDate = new Date(parts[2], parts[1] - 1, parts[0]);
              if (!latestDate || currentDate > latestDate) latestDate = currentDate;
            }
          }
        });
      }
    });
    if (latestDate) {
      const day = latestDate.getDate().toString().padStart(2, '0');
      const month = (latestDate.getMonth() + 1).toString().padStart(2, '0');
      const year = latestDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return null;
  };

  const getServiceCompletionDate = (service) => {
    if (!service.equipmentList || service.equipmentList.length === 0) return null;
    const allCompleted = service.equipmentList.every(eq => eq.status === 'C');
    if (!allCompleted) return null;
    let latestDate = null;
    service.equipmentList.forEach(eq => {
      if (eq.serviceDate && eq.serviceDate !== '-') {
        const parts = eq.serviceDate.split('/');
        if (parts.length === 3) {
          const currentDate = new Date(parts[2], parts[1] - 1, parts[0]);
          if (!latestDate || currentDate > latestDate) latestDate = currentDate;
        }
      }
    });
    if (latestDate) {
      const day = latestDate.getDate().toString().padStart(2, '0');
      const month = (latestDate.getMonth() + 1).toString().padStart(2, '0');
      const year = latestDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return null;
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSelectedStatuses(['all']);
    loadEmployeeData().finally(() => setRefreshing(false));
  }, []);

  const openUpdateService = (service, equipment) => {
    setUpdateData({ service, equipment });
    setUpdateModalVisible(true);
  };

  const openPlantDetails = (service) => {
    setViewingPlant(service);
    setViewDetailsModal(true);
  };

  const handleServiceUpdateComplete = () => {
    setUpdateModalVisible(false);
    loadEmployeeData();
  };

  const getLatestCompletionDate = (equipmentList) => {
    if (!equipmentList || equipmentList.length === 0) return null;
    const completedDates = equipmentList
      .filter(eq => eq.status === 'C' && eq.serviceDate)
      .map(eq => {
        const parts = eq.serviceDate.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        return null;
      })
      .filter(date => date !== null);
    if (completedDates.length === 0) return null;
    const latestDate = new Date(Math.max(...completedDates));
    const day = latestDate.getDate().toString().padStart(2, '0');
    const month = (latestDate.getMonth() + 1).toString().padStart(2, '0');
    const year = latestDate.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusCounts = () => {
    let all = serviceRequests.length;
    let assigned = 0, pending = 0, completed = 0;
    serviceRequests.forEach(req => {
      const equipmentList = req.equipmentList || [];
      const totalEquipment = equipmentList.length;
      const completedEquipment = equipmentList.filter(eq => eq.status === 'C').length;
      if (totalEquipment > 0 && completedEquipment === 0) assigned++;
      else if (totalEquipment > 0 && completedEquipment > 0 && completedEquipment < totalEquipment) pending++;
      else if (totalEquipment > 0 && completedEquipment === totalEquipment) completed++;
    });
    return { all, assigned, pending, completed };
  };

  const toggleStatusFilter = (status) => {
    setSelectedStatuses(current => {
      if (current.includes('all')) return [status];
      return current.includes(status)
        ? current.filter(selected => selected !== status)
        : [...current, status];
    });
  };

  const toggleAllStatusFilters = () => {
    setSelectedStatuses(current =>
      current.includes('all') ? [] : ['all']
    );
  };

  const renderStatusOption = (label, count, selected, onPress) => (
    <TouchableOpacity
      style={styles.statusOption}
      onPress={() => {
        onPress();
        setShowStatusDropdown(false);
      }}
    >
      <Text style={[styles.statusOptionText, selected && styles.statusOptionTextSelected]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  const applyDateFilter = (date) => {
    setTempDate(date);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    setSelectedDate(`${day}/${month}/${year}`);
    setDateFilterActive(true);
    setShowFilterDropdown(false);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) applyDateFilter(selectedDate);
  };

  const handlePlantSelect = (plant) => {
    setSelectedPlant(plant);
    setShowFilterDropdown(false);
  };

  const togglePlant = (plantName) => {
    setExpandedPlants(prev => ({
      ...prev,
      [plantName]: !prev[plantName]
    }));
  };

  const toggleService = (serviceId) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  const getFilterDisplayText = () => {
    const filters = [];
    if (selectedDate) filters.push(`Date: ${selectedDate}`);
    if (selectedPlant && selectedPlant !== 'all') filters.push(`${selectedPlant}`);
    if (filters.length === 0) return 'Filter';
    return filters.join(' • ');
  };

  const getServiceStatusText = (service) => {
    const equipmentList = service.equipmentList || [];
    const totalEquipment = equipmentList.length;
    const completedEquipment = equipmentList.filter(eq => eq.status === 'C').length;
    
    if (totalEquipment === 0) return 'No Equipment';
    if (completedEquipment === 0) return 'Assigned';
    if (completedEquipment > 0 && completedEquipment < totalEquipment) return 'In Progress';
    return 'Completed';
  };

  const getServiceStatusColor = (service) => {
    const equipmentList = service.equipmentList || [];
    const totalEquipment = equipmentList.length;
    const completedEquipment = equipmentList.filter(eq => eq.status === 'C').length;
    
    if (totalEquipment === 0) return '#9E9E9E';
    if (completedEquipment === 0) return '#FF9800';
    if (completedEquipment > 0 && completedEquipment < totalEquipment) return '#4CAF50';
    return '#EF4444';
  };

  const isRequestDateWithinFiveDays = (dateValue) => {
    if (typeof dateValue !== 'string' || dateValue === '-' || dateValue === 'N/A') return false;

    const parts = dateValue.split('/');
    if (parts.length !== 3) return false;

    const [day, month, year] = parts.map(Number);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
    if (day < 1 || month < 1 || month > 12 || year < 1) return false;

    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) return false;

    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const requestDateUtc = Date.UTC(year, month - 1, day);
    const daysSinceRequest = (todayUtc - requestDateUtc) / (24 * 60 * 60 * 1000);

    return daysSinceRequest >= 0 && daysSinceRequest <= 5;
  };

  const recentServices = serviceRequests.filter(service =>
    isRequestDateWithinFiveDays(service.date)
  );
  const newServiceIds = new Set(recentServices.map(service => String(service.id)));
  const newPlantNames = new Set(recentServices.map(service => service.plant).filter(Boolean));

  const isEquipmentNew = (service, equipment) => {
    if (equipment.status !== 'A') return false;
    return isRequestDateWithinFiveDays(service.date);
  };

  const statusCounts = getStatusCounts();

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1976d2" barStyle="light-content" translucent={false} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft} />
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.notificationIcon}
              onPress={() => setShowNotificationDropdown(prev => !prev)}
            >
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              {recentServices.length > 0 && (
                <View style={styles.notificationNewDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showNotificationDropdown && (
        <TouchableWithoutFeedback onPress={() => setShowNotificationDropdown(false)}>
          <View style={styles.notificationOverlay}>
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <View style={styles.notificationDropdown}>
                <View style={styles.notificationDropdownHeader}>
                  <Text style={styles.notificationDropdownTitle}>New Services</Text>
                  <TouchableOpacity onPress={() => setShowNotificationDropdown(false)}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
                {recentServices.length === 0 ? (
                  <View style={styles.noNotificationsDropdown}>
                    <Text style={styles.noNotificationsText}>No new services within 5 days</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.notificationList} showsVerticalScrollIndicator>
                    {recentServices.map(service => (
                      <View key={String(service.id)} style={styles.notificationDropdownItem}>
                        <View style={styles.notificationDetails}>
                          <Text style={styles.notificationPlantName}>{service.plant || 'Unknown plant'}</Text>
                          <Text style={styles.notificationServiceDetails}>
                            SR-{service.id} - Request date: {service.date}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      <View style={styles.filterRow}>
        <View style={styles.filterDropdownContainer}>
          <TouchableOpacity 
            style={[styles.filterBtn, (dateFilterActive || selectedPlant) && styles.filterBtnActive]}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Ionicons name="options-outline" size={16} color={(dateFilterActive || selectedPlant) ? '#fff' : '#1976d2'} />
            <Text style={[styles.filterBtnText, (dateFilterActive || selectedPlant) && styles.filterBtnTextActive]}>
              {getFilterDisplayText()}
            </Text>
            <Ionicons name="chevron-down" size={12} color={(dateFilterActive || selectedPlant) ? '#fff' : '#1976d2'} />
          </TouchableOpacity>
          
          {showFilterDropdown && (
            <View style={styles.filterDropdownMenu}>
              <TouchableOpacity style={styles.filterOption} onPress={() => {
                setShowFilterDropdown(false);
                setShowDatePicker(true);
              }}>
                <Ionicons name="calendar-outline" size={16} color="#1976d2" />
                <Text style={styles.filterOptionText}>
                  {selectedDate ? 'Change Date' : 'Select Date'}
                </Text>
              </TouchableOpacity>
              
              {selectedDate && (
                <TouchableOpacity style={styles.filterOptionClear} onPress={() => {
                  setSelectedDate('');
                  setDateFilterActive(false);
                  setShowFilterDropdown(false);
                }}>
                  <Ionicons name="close-circle" size={18} color="#d32f2f" />
                  <Text style={styles.filterOptionClearText}>{selectedDate}</Text>
                </TouchableOpacity>
              )}
              
              <View style={styles.filterDivider} />
              <TouchableOpacity 
                style={[styles.filterOption, selectedPlant === 'all' && styles.filterOptionActive]}
                onPress={() => handlePlantSelect('all')}
              >
                <Text style={[styles.filterOptionText, selectedPlant === 'all' && styles.filterOptionTextActive]}>All Plants</Text>
              </TouchableOpacity>
              {allPlantNames.map((plant, idx) => (
                <TouchableOpacity 
                  key={idx}
                  style={[styles.filterOption, selectedPlant === plant && styles.filterOptionActive]}
                  onPress={() => handlePlantSelect(plant)}
                >
                  <Text style={[styles.filterOptionText, selectedPlant === plant && styles.filterOptionTextActive]}>{plant}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusDropdownContainer}>
          <TouchableOpacity 
            style={styles.statusBtn}
            onPress={() => setShowStatusDropdown(!showStatusDropdown)}
            accessibilityRole="button"
            accessibilityLabel="Open service status filters"
          >
            <Ionicons name="options-outline" size={20} color="#1976d2" />
          </TouchableOpacity>
          
          {showStatusDropdown && (
            <View style={styles.statusDropdownMenu}>
              <Text style={styles.statusDropdownTitle}>Multi-select</Text>
              {renderStatusOption('All', statusCounts.all, selectedStatuses.includes('all'), toggleAllStatusFilters)}
              {renderStatusOption('Assigned', statusCounts.assigned, selectedStatuses.includes('assigned'), () => toggleStatusFilter('assigned'))}
              {renderStatusOption('In Progress', statusCounts.pending, selectedStatuses.includes('pending'), () => toggleStatusFilter('pending'))}
              {renderStatusOption('Completed', statusCounts.completed, selectedStatuses.includes('completed'), () => toggleStatusFilter('completed'))}
            </View>
          )}
        </View>
      </View>

      {showDatePicker && (Platform.OS === 'ios' ? (
        <Modal
          animationType="fade"
          transparent
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerTitle}>Select date</Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setTempDate(date);
                }}
              />
              <View style={styles.datePickerActions}>
                <TouchableOpacity style={styles.datePickerAction} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerAction}
                  onPress={() => {
                    applyDateFilter(tempDate);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.datePickerConfirmText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      ))}

      <FlatList
        data={groupedPlants}
        keyExtractor={(item, index) => item.plantName + index}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1976d2']} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={60} color="#4CAF50" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No pending services</Text>
          </View>
        }
        renderItem={({ item: plant }) => {
          const overallStatus = getPlantOverallStatus(plant);
          const isExpanded = expandedPlants[plant.plantName];
          const isNewPlant = newPlantNames.has(plant.plantName);
          const lastServiced = getPlantLastServicedDate(plant.services);
          
          const sortedServices = [...plant.services].sort((a, b) => {
            const priorityA = getStatusPriority(a);
            const priorityB = getStatusPriority(b);
            return priorityA - priorityB;
          });
          
          return (
            <View style={styles.treeviewContainer}>
              <TouchableOpacity 
                style={[styles.treeviewHeader, isNewPlant && styles.newPlantHeader]}
                onPress={() => togglePlant(plant.plantName)}
                activeOpacity={0.7}
              >
                <View style={styles.treeviewLeft}>
                  <Ionicons 
                    name={isExpanded ? "chevron-down" : "chevron-forward"} 
                    size={18} 
                    color="#1976d2" 
                  />
                  <View>
                    <Text style={styles.treeviewPlantName}>{plant.plantName}</Text>
                    {isNewPlant && (
                      <View style={styles.plantNewBadge}>
                        <Text style={styles.plantNewBadgeText}>NEW</Text>
                      </View>
                    )}
                    {lastServiced && (
                      <Text style={styles.treeviewLastServiced}>
                        Last serviced: {lastServiced}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.treeviewRight}>
                  <Text style={[styles.treeviewBadgeText, { color: overallStatus.color }]}>
                    {overallStatus.text}
                  </Text>
                  <Text style={styles.treeviewCount}>
                    {plant.completedCount}/{plant.totalServices}
                  </Text>
                </View>
              </TouchableOpacity>
              
              {isExpanded && (
                <View style={styles.treeviewContent}>
                  <View style={styles.treeviewStats}>
                    <Text style={styles.treeviewStatText}>Total: {plant.totalServices}</Text>
                    <Text style={styles.treeviewStatText}>Done: {plant.completedCount}</Text>
                    <Text style={styles.treeviewStatText}>Progress: {plant.inProgressCount}</Text>
                    <Text style={styles.treeviewStatText}>Pending: {plant.pendingCount}</Text>
                  </View>
                  
                  <View style={styles.serviceTable}>
                    <View style={styles.serviceTableHeader}>
                      <Text style={[styles.serviceTableHeading, styles.serviceIdColumn]}>SR ID</Text>
                      <Text style={[styles.serviceTableHeading, styles.serviceDateColumn]}>Request date</Text>
                      <Text style={[styles.serviceTableHeading, styles.serviceStatusColumn]}>Status</Text>
                      <Text style={[styles.serviceTableHeading, styles.serviceEquipmentColumn]}>Equipment</Text>
                    </View>
                  {sortedServices.map(service => {
                    const allCompleted = service.equipmentList?.length > 0 && service.equipmentList?.every(eq => eq.status === 'C');
                    const totalEquipment = service.equipmentList?.length || 0;
                    const isNewService = newServiceIds.has(String(service.id));
                    const statusText = getServiceStatusText(service);
                    const statusColor = getServiceStatusColor(service);
                    const serviceKey = String(service.id);
                    const isServiceExpanded = expandedServices[serviceKey];
                    
                    let displayEquipment = service.equipmentList || [];
                    if (!selectedStatuses.includes('completed') && !selectedStatuses.includes('all')) {
                      displayEquipment = displayEquipment.filter(eq => eq.status !== 'C');
                    }
                    
                    if (displayEquipment.length === 0 && !selectedStatuses.includes('all')) return null;
                    
                    return (
                      <View key={serviceKey} style={[styles.treeviewServiceItem, isNewService && styles.newServiceItem]}>
                        <TouchableOpacity
                          style={styles.serviceTableRow}
                          onPress={() => toggleService(serviceKey)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`SR-${service.id}, ${service.date}, ${statusText}. ${isServiceExpanded ? 'Hide' : 'Show'} details`}
                        >
                          <View style={[styles.serviceTableCell, styles.serviceIdColumn]}>
                            <Text style={styles.serviceId}>SR-{service.id}</Text>
                            {isNewService && <Text style={styles.newBadgeText}>NEW</Text>}
                          </View>
                          <Text style={[styles.serviceTableCellText, styles.serviceDateColumn]} numberOfLines={1}>
                            {service.date || '-'}
                          </Text>
                          <Text style={[styles.serviceTableCellText, styles.serviceStatusColumn, { color: statusColor }]}>
                            {statusText}
                          </Text>
                          <Text style={[styles.serviceTableCellText, styles.serviceEquipmentColumn]}>
                            {totalEquipment}
                          </Text>
                        </TouchableOpacity>

                        {isServiceExpanded && (
                          <View style={styles.serviceExpandedContent}>
                            {getServiceCompletionDate(service) && (
                              <View style={styles.serviceDateRow}>
                                <Text style={[styles.serviceDate, { color: '#EF4444' }]}>
                                  Completed: {getServiceCompletionDate(service)}
                                </Text>
                              </View>
                            )}

                            <View style={styles.equipmentListContainer}>
                              <Text style={styles.equipmentListTitle}>Equipment ({displayEquipment.length})</Text>
                              {displayEquipment.map((eq, eqIdx) => {
                                const isNewEquipment = isEquipmentNew(service, eq);

                                return (
                                  <View key={eqIdx} style={[styles.equipmentListItem, isNewEquipment && styles.newEquipmentItem]}>
                                    <View style={styles.equipmentItemLeft}>
                                      <View style={{ flex: 1 }}>
                                        <View style={styles.equipmentNameRow}>
                                          <Text style={styles.equipmentItemName}>{eq.name}</Text>
                                          {isNewEquipment && (
                                            <View style={styles.equipmentNewBadge}>
                                              <Text style={styles.equipmentNewBadgeText}>NEW</Text>
                                            </View>
                                          )}
                                        </View>
                                        <Text style={styles.equipmentItemModel}>Model: {eq.model || '-'}</Text>
                                        {eq.status === 'C' && eq.parts && eq.parts.length > 0 && (
                                          <View style={styles.partsSummary}>
                                            <Text style={styles.partsSummaryText}>{eq.parts.length} part(s) used</Text>
                                          </View>
                                        )}
                                      </View>
                                    </View>
                                    {eq.status !== 'C' && (
                                      <TouchableOpacity style={styles.updateSmallBtn} onPress={() => openUpdateService(service, eq)}>
                                        <Text style={styles.updateSmallBtnText}>Update</Text>
                                      </TouchableOpacity>
                                    )}
                                    {eq.status === 'C' && (
                                      <View style={styles.completedBadgeSmall}>
                                        <Text style={styles.completedBadgeSmallText}>Done</Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>

                            {!allCompleted && displayEquipment.length > 0 && (
                              <View style={styles.footerLocked}>
                                <Text style={styles.footerLockedText}>Complete all equipment</Text>
                              </View>
                            )}

                            {allCompleted && (
                              <TouchableOpacity style={styles.viewDetailsBtn} onPress={() => openPlantDetails(service)}>
                                <Text style={styles.viewDetailsBtnText}>View Details</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* View Details Modal */}
      <Modal animationType="slide" transparent={true} visible={viewDetailsModal} onRequestClose={() => setViewDetailsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Service Details</Text>
              <TouchableOpacity onPress={() => setViewDetailsModal(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {viewingPlant && (
                <View>
                  <View style={styles.modalInfoCard}>
                    <Text style={styles.modalPlantName}>{viewingPlant.plant}</Text>
                    <Text style={styles.modalSRID}>SR-{viewingPlant.id}</Text>
                    <Text style={styles.modalDate}>Request: {viewingPlant.date}</Text>
                    {getLatestCompletionDate(viewingPlant.equipmentList) && (
                      <Text style={styles.modalServicedDate}>Completed: {getLatestCompletionDate(viewingPlant.equipmentList)}</Text>
                    )}
                  </View>
                  <Text style={styles.modalSubtitle}>Equipment Details</Text>
                  {viewingPlant.equipmentList?.map((eq, idx) => (
                    <View key={idx} style={styles.modalEquipmentCard}>
                      <View style={styles.modalEquipmentHeader}>
                        <Text style={styles.modalEquipmentName}>{eq.name}</Text>
                        <Text style={[styles.modalEquipmentStatus, { color: eq.status === 'C' ? '#EF4444' : (eq.status === 'A' ? '#FF9800' : '#4CAF50') }]}>
                          {eq.status === 'C' ? 'Completed' : (eq.status === 'A' ? 'Assigned' : 'In Progress')}
                        </Text>
                      </View>
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>Model:</Text>
                        <Text style={styles.modalDetailValue}>{eq.model || '-'}</Text>
                      </View>
                      {eq.status === 'C' && (
                        <>
                          <View style={styles.modalDetailRow}>
                            <Text style={styles.modalDetailLabel}>Service Date:</Text>
                            <Text style={styles.modalDetailValue}>{eq.serviceDate || '-'}</Text>
                          </View>
                          <View style={styles.modalDetailRow}>
                            <Text style={styles.modalDetailLabel}>Service Type:</Text>
                            <Text style={styles.modalDetailValue}>{eq.serviceTypeName || '-'}</Text>
                          </View>
                          {eq.remarks && eq.remarks !== '-' && (
                            <View style={styles.modalDetailRow}>
                              <Text style={styles.modalDetailLabel}>Remarks:</Text>
                              <Text style={styles.modalDetailValue}>{eq.remarks}</Text>
                            </View>
                          )}
                          {eq.parts && eq.parts.length > 0 && (
                            <View style={styles.modalPartsSection}>
                              <Text style={styles.modalPartsTitle}>Parts Used ({eq.parts.length})</Text>
                              {eq.parts.map((part, pIdx) => (
                                <View key={pIdx} style={styles.modalPartRow}>
                                  <Text style={styles.modalPartName}>{part.partName}</Text>
                                  <Text style={styles.modalPartDetail}>
                                    {part.qty} × ₹{part.rate}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                      {eq.status !== 'C' && (
                        <TouchableOpacity 
                          style={styles.updateButton}
                          onPress={() => {
                            setViewDetailsModal(false);
                            openUpdateService(viewingPlant, eq);
                          }}
                        >
                          <Text style={styles.updateButtonText}>Update Service</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setViewDetailsModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={false} visible={updateModalVisible} onRequestClose={() => setUpdateModalVisible(false)}>
        {updateData && <UpdateServiceScreen data={updateData.service} equipment={updateData.equipment} onClose={() => setUpdateModalVisible(false)} onComplete={handleServiceUpdateComplete} />}
      </Modal>
    </View>
  );
}

// UpdateServiceScreen Component (keep as is)
function UpdateServiceScreen({ data, equipment, onClose, onComplete }) {
  const [remarks, setRemarks] = useState('');
  const [selectedParts, setSelectedParts] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [showServiceTypeDropdown, setShowServiceTypeDropdown] = useState(false);
  const [showPartsDropdown, setShowPartsDropdown] = useState(false);
  const [selectedPartForAdd, setSelectedPartForAdd] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);

  useEffect(() => { initializeData(); }, []);

  const initializeData = async () => {
    setInitialLoading(true);
    await fetchServiceTypes();
    if (equipment.categoryId) await fetchPartsByCategory(equipment.categoryId);
    else Alert.alert('Error', 'Equipment category not found');
    setRemarks(equipment.remarks !== '-' && equipment.remarks ? equipment.remarks : '');
    setSelectedParts(equipment.parts || []);
    if (equipment.serviceTypeId) setSelectedServiceType(equipment.serviceTypeId);
    setInitialLoading(false);
  };

  const fetchServiceTypes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/service-types`);
      let serviceTypesData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const formattedTypes = serviceTypesData.map(type => ({
        id: type.id?.toString() || type.ServiceTypeID?.toString(),
        name: type.name || type.ServiceTypeName,
        rate: type.rate || type.Rate || 0,
        unit: type.unit || type.UnitOfMeasure || 'SERV'
      }));
      setServiceTypes(formattedTypes);
    } catch (error) { setServiceTypes([]); }
  };

  const fetchPartsByCategory = async (categoryId) => {
    try {
      setLoadingParts(true);
      const response = await axios.get(`${API_BASE}/parts/${categoryId}`);
      let partsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const formattedParts = partsData.map(part => ({
        partId: part.partId || part.PartID,
        partName: part.partName || part.PartName,
        rate: part.rate || part.Rate || 0,
        unit: part.unit || part.Unit || 'Nos'
      }));
      setAvailableParts(formattedParts);
    } catch (error) { setAvailableParts([]); }
    finally { setLoadingParts(false); }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.assets && result.assets.length > 0) {
        const selectedFile = result.assets[0];
        if (selectedFile.size && selectedFile.size > 50 * 1024 * 1024) { Alert.alert("File Too Large", "File size exceeds 50MB limit"); return; }
        setFile({ uri: selectedFile.uri, name: selectedFile.name, mimeType: selectedFile.mimeType, size: selectedFile.size });
      }
    } catch (e) { console.log(e); }
  };

  const uploadFile = async () => {
    if (!file) return "";
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: file.mimeType || 'application/octet-stream', name: file.name });
      const response = await axios.post(`${API_BASE}/uploadFile`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      return response.data.status === "success" ? response.data.fileName : "";
    } catch (error) { return ""; }
    finally { setUploading(false); }
  };

  const addPart = () => {
    if (!selectedPartForAdd) { Alert.alert('Select Part', 'Please select a part first'); return; }
    if (selectedParts.some(p => p.partId === selectedPartForAdd.partId)) { Alert.alert('Part Already Added', 'This part is already in the list'); return; }
    setSelectedParts([...selectedParts, { partId: selectedPartForAdd.partId, partName: selectedPartForAdd.partName, qty: partQuantity, rate: selectedPartForAdd.rate, unit: selectedPartForAdd.unit }]);
    setSelectedPartForAdd(null);
    setPartQuantity(1);
    setShowPartsDropdown(false);
  };

  const removePart = (partId) => {
    Alert.alert('Remove Part', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setSelectedParts(selectedParts.filter(p => p.partId !== partId)) }
    ]);
  };

  const updateQuantity = (partId, delta) => {
    setSelectedParts(selectedParts.map(p => p.partId === partId ? { ...p, qty: Math.max(1, p.qty + delta) } : p));
  };

  const handleSubmit = async () => {
    if (!selectedServiceType) { Alert.alert('Required', 'Please select a service type'); return; }
    if (selectedParts.length === 0) { Alert.alert('Required', 'Please add at least one part'); return; }
    setLoading(true);
    try {
      let uploadedFile = await uploadFile();
      const selectedType = serviceTypes.find(t => t.id === selectedServiceType);
      const payload = {
        srid: data.id,
        equipmentId: equipment.id,
        remarks: remarks || '-',
        status: 'C',
        serviceTypeId: selectedServiceType,
        serviceRate: selectedType?.rate || 0,
        file: uploadedFile,
        parts: selectedParts.map(p => ({ partId: p.partId, qty: p.qty }))
      };
      const response = await axios.post(`${API_BASE}/updateService`, payload);
      if (response.data.status === 'success') {
        Alert.alert('Success', 'Service completed successfully!');
        onComplete();
        onClose();
      } else Alert.alert('Error', response.data.message || 'Update failed');
    } catch (error) { Alert.alert('Error', 'Failed to update service'); }
    finally { setLoading(false); }
  };

  const getTotalAmount = () => {
    const partsTotal = selectedParts.reduce((sum, p) => sum + (p.rate * p.qty), 0);
    const selectedType = serviceTypes.find(t => t.id === selectedServiceType);
    return partsTotal + (selectedType?.rate || 0);
  };

  const getSelectedServiceTypeName = () => {
    const selected = serviceTypes.find(t => t.id === selectedServiceType);
    return selected ? selected.name : 'Select Service Type';
  };

  if (initialLoading) {
    return (
      <View style={styles.updateLoadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.updateLoadingText}>Loading service data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.updateContainer}>
      <View style={styles.updateHeader}>
        <TouchableOpacity onPress={onClose} style={styles.updateBackBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.updateHeaderTitle}>Complete Service</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView style={styles.updateContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.updateInfoCard}>
          <View style={styles.updateInfoRow}><Ionicons name="business-outline" size={20} color="#1976d2" /><View><Text style={styles.updateInfoLabel}>PLANT</Text><Text style={styles.updateInfoValue}>{data.plant}</Text></View></View>
          <View style={styles.updateInfoRow}><Ionicons name="hardware-chip-outline" size={20} color="#1976d2" /><View><Text style={styles.updateInfoLabel}>EQUIPMENT</Text><Text style={styles.updateInfoValue}>{equipment.name}</Text><Text style={styles.updateInfoSub}>Model: {equipment.model || 'N/A'}</Text></View></View>
        </View>
        <View style={styles.updateSection}>
          <Text style={styles.updateSectionTitle}>Service Type *</Text>
          <TouchableOpacity style={styles.professionalDropdown} onPress={() => setShowServiceTypeDropdown(!showServiceTypeDropdown)}>
            <Text style={[styles.professionalDropdownText, !selectedServiceType && styles.placeholderText]}>{getSelectedServiceTypeName()}</Text>
            <Ionicons name={showServiceTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color="#1976d2" />
          </TouchableOpacity>
          {showServiceTypeDropdown && (
            <View style={styles.professionalDropdownList}>
              <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled={true}>
                {serviceTypes.map(type => (
                  <TouchableOpacity key={type.id} style={[styles.professionalDropdownItem, selectedServiceType === type.id && styles.professionalDropdownItemSelected]} onPress={() => { setSelectedServiceType(type.id); setShowServiceTypeDropdown(false); }}>
                    <View><Text style={styles.dropdownItemTitle}>{type.name}</Text><Text style={styles.dropdownItemSubtitle}>₹{type.rate} / {type.unit}</Text></View>
                    {selectedServiceType === type.id && <Ionicons name="checkmark-circle" size={20} color="#0F766E" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        <View style={styles.updateSection}>
          <Text style={styles.updateSectionTitle}>Parts Used *</Text>
          <TouchableOpacity style={styles.professionalDropdown} onPress={() => setShowPartsDropdown(!showPartsDropdown)}>
            <Text style={styles.professionalDropdownText}>{selectedPartForAdd ? selectedPartForAdd.partName : 'Select Part'}</Text>
            <Ionicons name={showPartsDropdown ? "chevron-up" : "chevron-down"} size={20} color="#1976d2" />
          </TouchableOpacity>
          {showPartsDropdown && (
            <View style={styles.professionalDropdownList}>
              <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled={true}>
                {loadingParts ? <View style={styles.dropdownLoadingItem}><ActivityIndicator size="small" color="#1976d2" /><Text style={styles.dropdownLoadingText}>Loading parts...</Text></View> :
                 availableParts.length === 0 ? <View style={styles.dropdownEmptyItem}><Text style={styles.dropdownEmptyText}>No parts available</Text></View> :
                 availableParts.map(part => (
                  <TouchableOpacity key={part.partId} style={[styles.professionalDropdownItem, selectedPartForAdd?.partId === part.partId && styles.professionalDropdownItemSelected]} onPress={() => { setSelectedPartForAdd(part); setShowPartsDropdown(false); }}>
                    <View><Text style={styles.dropdownItemTitle}>{part.partName}</Text><Text style={styles.dropdownItemSubtitle}>₹{part.rate} / {part.unit}</Text></View>
                    {selectedPartForAdd?.partId === part.partId && <Ionicons name="checkmark-circle" size={20} color="#0F766E" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {selectedPartForAdd && (
            <View style={styles.quantityAddContainer}>
              <View style={styles.quantityControl}><Text style={styles.quantityLabel}>Quantity:</Text><View style={styles.quantityButtons}>
                <TouchableOpacity onPress={() => setPartQuantity(Math.max(1, partQuantity - 1))}><Ionicons name="remove-circle-outline" size={24} color="#d32f2f" /></TouchableOpacity>
                <Text style={styles.quantityValue}>{partQuantity}</Text>
                <TouchableOpacity onPress={() => setPartQuantity(partQuantity + 1)}><Ionicons name="add-circle-outline" size={24} color="#2e7d32" /></TouchableOpacity>
              </View></View>
              <TouchableOpacity style={styles.addPartButton} onPress={addPart}><Ionicons name="add-circle-outline" size={18} color="#fff" /><Text style={styles.addPartButtonText}>Add Part</Text></TouchableOpacity>
            </View>
          )}
        </View>
        {selectedParts.length > 0 && (
          <View style={styles.updateSection}>
            <Text style={styles.updateSectionTitle}>Added Parts</Text>
            {selectedParts.map((part, idx) => (
              <View key={idx} style={styles.selectedPartCard}>
                <View><Text style={styles.selectedPartName}>{part.partName}</Text><Text style={styles.selectedPartPrice}>₹{part.rate} × {part.qty} = ₹{part.rate * part.qty}</Text></View>
                <View style={styles.selectedPartActions}>
                  <TouchableOpacity onPress={() => updateQuantity(part.partId, -1)}><Ionicons name="remove-circle-outline" size={24} color="#d32f2f" /></TouchableOpacity>
                  <Text style={styles.selectedPartQty}>{part.qty}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(part.partId, 1)}><Ionicons name="add-circle-outline" size={24} color="#2e7d32" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => removePart(part.partId)}><Ionicons name="trash-outline" size={22} color="#d32f2f" /></TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.totalAmountContainer}><Text style={styles.totalAmountLabel}>Total Amount:</Text><Text style={styles.totalAmountValue}>₹{getTotalAmount()}</Text></View>
          </View>
        )}
        <View style={styles.updateSection}>
          <Text style={styles.updateSectionTitle}>Remarks</Text>
          <TextInput style={styles.remarksInput} value={remarks} onChangeText={setRemarks} multiline numberOfLines={3} placeholder="Add work details..." textAlignVertical="top" />
        </View>
        <View style={styles.updateSection}>
          <Text style={styles.updateSectionTitle}>Attach File</Text>
          <TouchableOpacity style={styles.fileButton} onPress={pickFile}><Ionicons name="cloud-upload-outline" size={22} color="#1976d2" /><Text style={styles.fileButtonText}>{file ? file.name : "Upload File (Max 50MB)"}</Text></TouchableOpacity>
          {file && <View style={styles.fileInfo}><Text style={styles.fileSize}>{(file.size / (1024 * 1024)).toFixed(2)} MB</Text><TouchableOpacity onPress={() => setFile(null)} style={styles.removeFileBtn}><Ionicons name="close-circle" size={16} color="#d32f2f" /><Text style={styles.removeFileText}>Remove</Text></TouchableOpacity></View>}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={[styles.completeBtn, (loading || !selectedServiceType || selectedParts.length === 0) && styles.completeBtnDisabled]} onPress={handleSubmit} disabled={loading || !selectedServiceType || selectedParts.length === 0}>
          {loading || uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.completeBtnText}>Complete Service</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  updateLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  updateLoadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  
  header: { backgroundColor: '#1976d2', paddingTop: 12, paddingBottom: 16, paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, zIndex: 5 },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  headerLeft: { width: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notificationIcon: { position: 'relative', padding: 4 },
  notificationNewDot: { position: 'absolute', top: 1, right: 1, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F44336', borderWidth: 1, borderColor: '#1976d2' },
  notificationOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: 'transparent' },
  notificationDropdown: { position: 'absolute', top: 60, right: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 10, minWidth: 220, maxWidth: 280, maxHeight: height * 0.6, zIndex: 1000, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, overflow: 'hidden' },
  notificationDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  notificationDropdownTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  notificationList: { maxHeight: height * 0.5 },
  notificationDropdownItem: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  notificationDetails: { flex: 1 },
  notificationPlantName: { fontSize: 13, fontWeight: '600', color: '#333' },
  notificationServiceDetails: { fontSize: 11, color: '#777', marginTop: 3 },
  noNotificationsDropdown: { padding: 20, alignItems: 'center' },
  noNotificationsText: { fontSize: 12, color: '#999' },
  
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8, zIndex: 10, backgroundColor: '#f5f7fa' },
  filterDropdownContainer: { position: 'relative', zIndex: 1002 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0', gap: 6 },
  filterBtnActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  filterBtnText: { fontSize: 12, color: '#1976d2', fontWeight: '500', maxWidth: 150 },
  filterBtnTextActive: { color: '#fff' },
  filterDropdownMenu: { position: 'absolute', top: 42, left: 0, backgroundColor: '#fff', borderRadius: 10, elevation: 10, minWidth: 200, maxHeight: 350, zIndex: 1003, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  filterOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  filterOptionActive: { backgroundColor: '#E3F2FD' },
  filterOptionText: { fontSize: 13, color: '#333' },
  filterOptionTextActive: { color: '#1976d2', fontWeight: '500' },
  filterOptionClear: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10, backgroundColor: '#FFEBEE' },
  filterOptionClearText: { fontSize: 13, color: '#d32f2f', fontWeight: '500' },
  filterDivider: { height: 1, backgroundColor: '#f0f0f0' },
  datePickerOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  datePickerContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  datePickerTitle: { fontSize: 16, fontWeight: '600', color: '#1a237e', marginBottom: 8 },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  datePickerAction: { paddingHorizontal: 14, paddingVertical: 9 },
  datePickerCancelText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  datePickerConfirmText: { color: '#1976d2', fontSize: 13, fontWeight: '700' },
  
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0', gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#333', padding: 0 },
  
  statusDropdownContainer: { position: 'relative', zIndex: 1001 },
  statusBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', width: 38, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  statusDropdownMenu: { position: 'absolute', top: 42, right: 0, backgroundColor: '#fff', borderRadius: 8, elevation: 10, minWidth: 135, zIndex: 1002, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statusDropdownTitle: { paddingHorizontal: 8, paddingVertical: 6, color: '#111827', fontSize: 12, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statusOption: { paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statusOptionText: { fontSize: 12, color: '#333' },
  statusOptionTextSelected: { color: '#1976d2', fontWeight: '600' },
  
  listContent: { paddingHorizontal: 12, paddingBottom: 20, paddingTop: 8 },
  emptyContainer: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', marginTop: 16 },
  emptyText: { marginTop: 8, color: '#999', fontSize: 14 },
  
  treeviewContainer: { marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#e8e8e8' },
  treeviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#fff' },
  newPlantHeader: { backgroundColor: '#E8F5E9' },
  treeviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  treeviewPlantName: { fontSize: 16, fontWeight: '600', color: '#1a237e' },
  plantNewBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 2 },
  plantNewBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  treeviewLastServiced: { fontSize: 11, color: '#4CAF50', marginTop: 4 },
  treeviewRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  treeviewBadgeText: { fontSize: 12, fontWeight: '500' },
  treeviewCount: { fontSize: 12, fontWeight: '600', color: '#666', minWidth: 40, textAlign: 'right' },
  treeviewContent: { padding: 12, paddingTop: 0, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#eef2f6' },
  treeviewStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eef2f6' },
  treeviewStatText: { fontSize: 11, color: '#666' },
  serviceTable: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5eaf0', borderRadius: 6, overflow: 'hidden' },
  serviceTableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef4fa', paddingHorizontal: 8, minHeight: 36, borderBottomWidth: 1, borderBottomColor: '#dce5ee' },
  serviceTableHeading: { fontSize: 10, fontWeight: '700', color: '#475569' },
  serviceTableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#edf1f5', backgroundColor: '#fff' },
  serviceTableCell: { justifyContent: 'center' },
  serviceTableCellText: { fontSize: 10, color: '#334155' },
  serviceIdColumn: { flex: 1.05 },
  serviceDateColumn: { flex: 1.25 },
  serviceStatusColumn: { flex: 1.2 },
  serviceEquipmentColumn: { flex: 0.8, textAlign: 'center' },
  newServiceItem: { backgroundColor: '#f5fbf6' },
  serviceExpandedContent: { borderTopWidth: 1, borderTopColor: '#eef2f6', paddingHorizontal: 10, paddingBottom: 8 },
  serviceId: { fontSize: 10, fontWeight: '600', color: '#1976d2' },
  newBadgeText: { color: '#2e7d32', fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  serviceDateRow: { marginBottom: 8 },
  serviceDate: { fontSize: 10, color: '#666' },
  
  equipmentListContainer: { marginTop: 8 },
  equipmentListTitle: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 6 },
  equipmentListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#edf1f5' },
  newEquipmentItem: { backgroundColor: '#f5fbf6', borderLeftWidth: 3, borderLeftColor: '#4CAF50', paddingLeft: 8 },
  equipmentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  equipmentItemName: { fontSize: 11, fontWeight: '500', color: '#333' },
  equipmentNewBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  equipmentNewBadgeText: { fontSize: 8, color: '#2e7d32', fontWeight: 'bold' },
  equipmentItemModel: { fontSize: 9, color: '#999', marginTop: 2 },
  equipmentItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  partsSummary: { marginTop: 4 },
  partsSummaryText: { fontSize: 9, color: '#666' },
  updateSmallBtn: { backgroundColor: '#1976d2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  updateSmallBtnText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  completedBadgeSmall: { backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  completedBadgeSmallText: { fontSize: 9, color: '#EF4444', fontWeight: '500' },
  
  footerLocked: { alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerLockedText: { fontSize: 9, color: '#bbb' },
  viewDetailsBtn: { alignItems: 'flex-end', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  viewDetailsBtnText: { fontSize: 10, color: '#1976d2', fontWeight: '500' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 20, width: width * 0.92, maxHeight: height * 0.85, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a237e' },
  modalInfoCard: { marginBottom: 16 },
  modalPlantName: { fontSize: 20, fontWeight: 'bold', color: '#1a237e', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#1976d2', alignSelf: 'flex-start' },
  modalSRID: { fontSize: 13, color: '#1976d2', fontWeight: '500', marginBottom: 8 },
  modalDate: { fontSize: 13, color: '#666', marginBottom: 6 },
  modalServicedDate: { fontSize: 13, color: '#4caf50', fontWeight: '500', marginBottom: 6 },
  modalSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#1976d2', marginTop: 20, marginBottom: 15, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalEquipmentCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#eef2f6' },
  modalEquipmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalEquipmentName: { fontSize: 16, fontWeight: 'bold', color: '#1a237e', flex: 1 },
  modalEquipmentStatus: { fontSize: 12, fontWeight: '600' },
  modalDetailRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
  modalDetailLabel: { fontSize: 12, color: '#888', width: 95, fontWeight: '500' },
  modalDetailValue: { fontSize: 12, color: '#333', flex: 1, fontWeight: '500' },
  modalPartsSection: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  modalPartsTitle: { fontSize: 13, fontWeight: 'bold', color: '#1976d2', marginBottom: 10 },
  modalPartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingLeft: 8 },
  modalPartName: { fontSize: 12, color: '#555', flex: 1 },
  modalPartDetail: { fontSize: 12, color: '#1976d2', fontWeight: '600' },
  updateButton: { marginTop: 12, backgroundColor: '#1976d2', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  updateButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  modalCloseBtn: { marginTop: 20, backgroundColor: '#1976d2', padding: 14, borderRadius: 12, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  
  updateContainer: { flex: 1, backgroundColor: '#f5f7fa' },
  updateHeader: { backgroundColor: '#1976d2', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  updateBackBtn: { padding: 4 },
  updateHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerPlaceholder: { width: 32 },
  updateContent: { flex: 1, padding: 12 },
  updateInfoCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e5eaf0', elevation: 1 },
  updateInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  updateInfoLabel: { fontSize: 10, color: '#666', marginBottom: 2, textTransform: 'uppercase' },
  updateInfoValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  updateInfoSub: { fontSize: 11, color: '#666', marginTop: 2 },
  updateSection: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e5eaf0', elevation: 1 },
  updateSectionTitle: { fontSize: 14, fontWeight: '600', color: '#1a237e', marginBottom: 12 },
  professionalDropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: '#e5eaf0' },
  professionalDropdownText: { fontSize: 14, color: '#333', flex: 1 },
  placeholderText: { color: '#999' },
  professionalDropdownList: { marginTop: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5eaf0', overflow: 'hidden', zIndex: 1000 },
  professionalDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf1f5' },
  professionalDropdownItemSelected: { backgroundColor: '#E6F4F1' },
  dropdownItemTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  dropdownItemSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  dropdownEmptyItem: { padding: 20, alignItems: 'center' },
  dropdownEmptyText: { fontSize: 13, color: '#999' },
  dropdownLoadingItem: { padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  dropdownLoadingText: { fontSize: 13, color: '#666' },
  quantityAddContainer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quantityLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  quantityButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quantityValue: { fontSize: 16, fontWeight: '600', color: '#333', minWidth: 30, textAlign: 'center' },
  addPartButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1976d2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  addPartButtonText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  selectedPartCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5eaf0' },
  selectedPartName: { fontSize: 14, fontWeight: '500', color: '#333' },
  selectedPartPrice: { fontSize: 11, color: '#666', marginTop: 2 },
  selectedPartActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedPartQty: { fontSize: 15, fontWeight: '600', color: '#333', minWidth: 25, textAlign: 'center' },
  totalAmountContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalAmountLabel: { fontSize: 14, fontWeight: '600', color: '#666' },
  totalAmountValue: { fontSize: 18, fontWeight: 'bold', color: '#0F766E' },
  remarksInput: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, minHeight: 80, fontSize: 13, color: '#333', borderWidth: 1, borderColor: '#e5eaf0', textAlignVertical: 'top' },
  fileButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef4fa', padding: 12, borderRadius: 8, gap: 10 },
  fileButtonText: { fontSize: 13, color: '#1976d2', flex: 1 },
  fileInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  fileSize: { fontSize: 11, color: '#888' },
  removeFileBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeFileText: { fontSize: 11, color: '#d32f2f' },
  bottomButtonContainer: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5eaf0' },
  completeBtn: { backgroundColor: '#1976d2', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export { UpdateServiceScreen };