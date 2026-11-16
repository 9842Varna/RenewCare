import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TextInput,
  Modal,
  Dimensions,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';

//const API_BASE = 'http://10.196.32.8:2927/api';
const API_BASE = 'http://192.168.29.223:2927/api';
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  bg:               '#F5F7FA',
  white:            '#FFFFFF',
  primary:          '#2B78C5',
  primaryLight:     '#E8F1FA',
  primaryHighlight: '#D6E9F8',
  success:          '#28A745',
  successLight:     '#E8F5E9',
  warning:          '#FFC107',
  warningLight:     '#FFF9E6',
  danger:           '#DC3545',
  dangerLight:      '#FEE8E8',
  text1:            '#2C3E50',
  text2:            '#6C757D',
  text3:            '#95A5A6',
  border:           '#E9ECEF',
  headerBg:         '#2B78C5',
};

export default function PlantsScreen({ user, navigation, route, onBackToServices, hideHeader = true }) {
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterAnchorRef = useRef(null);
  const [filterMenuPosition, setFilterMenuPosition] = useState({ top: 8, left: 12 });
  const [employeeId, setEmployeeId] = useState(null);
  const [expandedPlants, setExpandedPlants] = useState({});
  const [highlightedPlant, setHighlightedPlant] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedPlant, setSelectedPlant] = useState('all');
  
  // Date filter
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateDraft, setDateDraft] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');

  // Bottom sheet state
  const [selectedService, setSelectedService] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [openingFile, setOpeningFile] = useState(null);
  const [isOpeningFile, setIsOpeningFile] = useState(false);

  // Clear cache on component mount
  useEffect(() => {
    const clearBackendCache = async () => {
      try {
        await axios.get(`${API_BASE}/clear-cache?t=${Date.now()}`);
        console.log('✅ Backend cache cleared');
      } catch (e) {
        console.log('Cache clear error:', e);
      }
    };
    clearBackendCache();
    
    loadEmployeeData();
  }, []);

  useEffect(() => {
    filterAndSortPlants();
  }, [plants, searchQuery, selectedStatus, selectedDistrict, selectedDateStr, selectedPlant]);

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
      if (empId) await fetchPlantsAndServices(empId);
      else setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchPlantsAndServices = async (empId) => {
    try {
      setLoading(true);
      const [dashRes, plantRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/${empId}`),
        axios.get(`${API_BASE}/plants-district/${empId}`).catch(() => ({ data: [] }))
      ]);

      const services = dashRes.data.complaints || [];
      const plantMeta = Array.isArray(plantRes.data) ? plantRes.data : [];

      const districtMap = {};
      plantMeta.forEach(p => {
        districtMap[p.name] = p.district || '';
      });

      const plantMap = new Map();

      services.forEach((service) => {
        const plantName = service.plant;
        if (!plantName) return;

        if (!plantMap.has(plantName)) {
          plantMap.set(plantName, {
            id: plantMap.size + 1,
            name: plantName,
            district: districtMap[plantName] || '',
            status: 'pending',
            lastServicedDate: null,
            pendingCount: 0,
            inProgressCount: 0,
            completedCount: 0,
            totalServices: 0,
            services: []
          });
        }

        const plant = plantMap.get(plantName);
        plant.services.push(service);
        plant.totalServices++;

        const eqList = service.equipmentList || [];
        const totalEq = eqList.length;
        const completedEq = eqList.filter(e => e.status === 'C').length;

        if (totalEq > 0 && completedEq === totalEq) plant.completedCount++;
        else if (totalEq > 0 && completedEq > 0) plant.inProgressCount++;
        else plant.pendingCount++;
      });

      plantMap.forEach(plant => {
        if (plant.pendingCount === 0 && plant.inProgressCount === 0) {
          plant.status = 'completed';
        } else {
          plant.status = 'pending';
        }

        let lastDate = null;
        plant.services.forEach(service => {
          const eqList = service.equipmentList || [];
          const totalEq = eqList.length;
          const completedEq = eqList.filter(e => e.status === 'C').length;

          if (totalEq > 0 && completedEq > 0 && service.date && service.date !== 'N/A') {
            const parts = service.date.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const year = parseInt(parts[2], 10);
              const serviceDate = new Date(year, month, day);
              if (!isNaN(serviceDate) && (!lastDate || serviceDate > lastDate)) {
                lastDate = serviceDate;
              }
            }
          }
        });

        if (lastDate) {
          const day = lastDate.getDate().toString().padStart(2, '0');
          const month = (lastDate.getMonth() + 1).toString().padStart(2, '0');
          const year = lastDate.getFullYear();
          plant.lastServicedDate = `${day}/${month}/${year}`;
        }

        plant.services.sort((a, b) => {
          const da = (a.date || '').split('/').reverse().join('-');
          const db = (b.date || '').split('/').reverse().join('-');
          return db.localeCompare(da);
        });
      });

      const plantsArray = Array.from(plantMap.values());
      setPlants(plantsArray);

      const districtSet = new Set();
      plantsArray.forEach(plant => {
        if (plant.district && plant.district !== '') {
          districtSet.add(plant.district);
        }
      });
      const uniqueDistricts = ['all', ...Array.from(districtSet).sort()];
      setDistricts(uniqueDistricts);
    } catch (e) {
      console.error('Fetch error:', e);
      setPlants([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedDistrict('all');
    setSelectedPlant('all');
    setSelectedDate(null);
    setSelectedDateStr('');
    setShowFilterDropdown(false);
  };

  const filterAndSortPlants = () => {
    let filtered = [...plants];

    if (selectedPlant !== 'all') {
      filtered = filtered.filter(p => p.name === selectedPlant);
    }

    if (selectedStatus === 'pending') {
      filtered = filtered.filter(p => p.status === 'pending');
    } else if (selectedStatus === 'completed') {
      filtered = filtered.filter(p => p.status === 'completed');
    }

    if (selectedDistrict !== 'all') {
      filtered = filtered.filter(p => p.district === selectedDistrict);
    }

    if (selectedDateStr) {
      filtered = filtered.filter(plant =>
        plant.services.some(srv => {
          if (!srv.date || srv.date === 'N/A') return false;
          return srv.date === selectedDateStr;
        })
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.district?.toLowerCase().includes(q)
      );
    }

    setFilteredPlants(filtered);
  };

  const openDatePicker = () => {
    setDateDraft(selectedDate || new Date());
    setShowFilterDropdown(false);
    setShowDatePicker(true);
  };

  const applyDateFilter = (date) => {
    setSelectedDate(date);
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    setSelectedDateStr(`${d}/${m}/${y}`);
  };

  const onDateChange = (event, date) => {
    if (Platform.OS === 'ios') {
      if (date) setDateDraft(date);
      return;
    }

    setShowDatePicker(false);
    if (event.type === 'set' && date) applyDateFilter(date);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    setSelectedDateStr('');
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEmployeeData().finally(() => setRefreshing(false));
  }, []);

  const togglePlant = (plantName) => {
    setHighlightedPlant(plantName);
    setExpandedPlants(prev => ({ ...prev, [plantName]: !prev[plantName] }));
    setTimeout(() => setHighlightedPlant(null), 500);
  };

  const handleServicePress = (service) => {
    setSelectedService(service);
    setShowBottomSheet(true);
  };

  const getPlantStatus = (plant) => {
    if (plant.pendingCount > 0 || plant.inProgressCount > 0)
      return { text: 'Pending', color: C.warning, bg: C.warningLight };
    return { text: 'Completed', color: C.success, bg: C.successLight };
  };

  const getServiceStatus = (service) => {
    const eqList = service.equipmentList || [];
    const totalEq = eqList.length;
    const completedEq = eqList.filter(e => e.status === 'C').length;
    if (totalEq === 0) return { text: 'Pending', color: C.warning, bg: C.warningLight };
    if (completedEq === totalEq) return { text: 'Completed', color: C.success, bg: C.successLight };
    if (completedEq > 0) return { text: 'In Progress', color: C.primary, bg: C.primaryLight };
    return { text: 'Pending', color: C.warning, bg: C.warningLight };
  };

  const getEqStatus = (status) => {
    if (status === 'C') return { text: 'Completed', color: C.success };
    if (status === 'A') return { text: 'Pending', color: C.warning };
    return { text: 'In Progress', color: C.primary };
  };

  const formatDate = (d) => (!d || d === 'N/A' || d === '-') ? '—' : d;

  // Get file name from path
  const getFileName = (filePath) => {
    if (!filePath || filePath === '-') return 'View Document';
    // Extract filename from path
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    // Truncate if too long
    if (fileName.length > 30) {
      return fileName.substring(0, 27) + '...';
    }
    return fileName;
  };

  const viewFileInBrowser = async (fileName) => {
    if (isOpeningFile) {
      console.log('Already processing, ignoring duplicate click');
      return;
    }
    
    if (!fileName || fileName === '-' || !fileName.trim()) {
      Alert.alert('No Attachment', 'No file attached to this equipment.');
      return;
    }

    setIsOpeningFile(true);
    setOpeningFile(fileName);
    
    try {
      await axios.get(`${API_BASE}/clear-cache?t=${Date.now()}`).catch(() => {});
      
      const timestamp = Date.now();
      const fileUrl = `${API_BASE}/files/${fileName}?t=${timestamp}&force=1`;
      
      console.log('📁 Opening file:', fileUrl);
      
      await WebBrowser.openBrowserAsync(fileUrl);
      
    } catch (e) {
      console.error('Error opening file:', e);
      Alert.alert('Error', 'Could not open file. Please try again.');
    } finally {
      setTimeout(() => {
        setIsOpeningFile(false);
        setOpeningFile(null);
      }, 2000);
    }
  };

  const statusCounts = {
    all: plants.length,
    pending: plants.filter(p => p.status === 'pending').length,
    completed: plants.filter(p => p.status === 'completed').length,
  };
  const filterMenuHeight = Math.min(
    320,
    SCREEN_HEIGHT * 0.55,
    (plants.length + Math.max(districts.length - 1, 0) + 4) * 42
  );
  const filterMenuWidth = Math.min(250, SCREEN_WIDTH - 24);

  const openFilterDropdown = () => {
    const anchor = filterAnchorRef.current;
    if (!anchor) {
      setShowFilterDropdown(true);
      return;
    }

    anchor.measureInWindow((x, y, _width, height) => {
      const maxTop = Math.max(8, SCREEN_HEIGHT - filterMenuHeight - 8);
      const top = Math.max(8, Math.min(y + height + 4, maxTop));
      const left = Math.max(8, Math.min(x, SCREEN_WIDTH - filterMenuWidth - 8));
      setFilterMenuPosition({ top, left });
      setShowFilterDropdown(true);
    });
  };

  const renderEquipmentInSheet = (eq, idx) => {
    const eqSt = getEqStatus(eq.status);
    const isOpening = openingFile === eq.attachFile || isOpeningFile;
    const fileName = getFileName(eq.attachFile);
    
    return (
      <View key={idx} style={styles.sheetEqCard}>
        <View style={styles.sheetEqHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetEqName}>{eq.name}</Text>
            {eq.model && eq.model !== '-' && (
              <Text style={styles.sheetEqModel}>Model: {eq.model}</Text>
            )}
          </View>
          <View style={[styles.sheetEqStatusBadge, { backgroundColor: eqSt.color + '18' }]}>
            <Text style={[styles.sheetEqStatusText, { color: eqSt.color }]}>{eqSt.text}</Text>
          </View>
        </View>

        {eq.status === 'C' && (
          <View style={styles.sheetEqDetails}>
            {eq.serviceTypeName && eq.serviceTypeName !== '-' && (
              <View style={styles.sheetEqDetailRow}>
                <Text style={styles.sheetEqDetailLabel}>Service Type</Text>
                <Text style={styles.sheetEqDetailValue}>{eq.serviceTypeName}</Text>
              </View>
            )}
            {eq.serviceDate && eq.serviceDate !== '-' && (
              <View style={styles.sheetEqDetailRow}>
                <Text style={styles.sheetEqDetailLabel}>Serviced On</Text>
                <Text style={styles.sheetEqDetailValue}>{eq.serviceDate}</Text>
              </View>
            )}
            {eq.remarks && eq.remarks !== '-' && (
              <View style={styles.sheetEqDetailRow}>
                <Text style={styles.sheetEqDetailLabel}>Remarks</Text>
                <Text style={styles.sheetEqDetailValue}>{eq.remarks}</Text>
              </View>
            )}

            {eq.parts && eq.parts.length > 0 && (
              <View style={styles.sheetPartsWrap}>
                <Text style={styles.sheetPartsTitle}>Parts Used</Text>
                {eq.parts.map((part, pIdx) => (
                  <View key={pIdx} style={styles.sheetPartRow}>
                    <Text style={styles.sheetPartName}>{part.partName}</Text>
                    <Text style={styles.sheetPartMeta}>
                      {part.qty} × ₹{part.rate} = ₹{(part.qty * part.rate).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {eq.attachFile && eq.attachFile !== '-' && (
              <TouchableOpacity
                style={styles.sheetAttachBtn}
                onPress={() => viewFileInBrowser(eq.attachFile)}
                disabled={isOpening}
              >
                {isOpening ? (
                  <View style={styles.downloadProgressContainer}>
                    <ActivityIndicator size="small" color={C.primary} />
                    <Text style={styles.downloadProgressText}>Opening...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="document-outline" size={16} color={C.primary} />
                    <Text style={styles.sheetAttachBtnText} numberOfLines={1} ellipsizeMode="middle">
                      {fileName}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderPlant = ({ item: plant }) => {
    const pSt = getPlantStatus(plant);
    const isExpanded = expandedPlants[plant.name];
    const isHighlighted = highlightedPlant === plant.name;

    return (
      <View style={[styles.plantCard, isHighlighted && styles.plantCardHighlighted]}>
        <TouchableOpacity style={styles.plantHeader} onPress={() => togglePlant(plant.name)} activeOpacity={0.7}>
          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={C.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.plantName}>{plant.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={12} color={C.primary} />
              <Text style={styles.locationText}>{plant.district || 'Location not set'}</Text>
            </View>
          </View>
          <View style={[styles.plantStatusBadge, { backgroundColor: pSt.bg }]}>
            <Text style={[styles.plantStatusText, { color: pSt.color }]}>{pSt.text}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              <Text style={[styles.thCell, styles.tableSrColumn]}>SR ID</Text>
              <Text style={[styles.thCell, styles.tableDateColumn]}>Date</Text>
              <Text style={[styles.thCell, styles.tableEquipmentColumn]}>Equipment</Text>
              <Text style={[styles.thCell, styles.tableStatusColumn]}>Status</Text>
            </View>

            {plant.services.length === 0 ? (
              <View style={styles.noDataRow}>
                <Text style={styles.noDataText}>No services</Text>
              </View>
            ) : (
              plant.services.map((srv, idx) => {
                const sSt = getServiceStatus(srv);
                const isLast = idx === plant.services.length - 1;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.tableRow, isLast && { borderBottomWidth: 0 }]}
                    onPress={() => handleServicePress(srv)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`View details for SR-${srv.id}`}
                  >
                    <Text style={[styles.tdCell, styles.tableSrColumn, { color: C.primary, fontWeight: '600' }]} numberOfLines={1}>SR-{srv.id}</Text>
                    <Text style={[styles.tdCell, styles.tableDateColumn, { color: C.text2, fontSize: 11 }]} numberOfLines={1}>{formatDate(srv.date)}</Text>
                    <Text style={[styles.tdCell, styles.tableEquipmentColumn, { color: C.text2, fontSize: 11 }]} numberOfLines={1}>
                      {srv.equipmentList?.length || 0}
                    </Text>
                    <Text style={[styles.statusText, styles.tableStatusColumn, { color: sSt.color, fontSize: 11, fontWeight: '500' }]} numberOfLines={1}>
                      {sSt.text}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  };

  const handleBackPress = () => {
    if (onBackToServices) {
      onBackToServices();
    } else if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading plants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1976d2" barStyle="light-content" />
      
      {/* HEADER REMOVED - Now handled by App.js */}
      {/* The back button and title have been removed - use App.js header navigation */}

      <View style={styles.filterRow}>
        <View ref={filterAnchorRef} collapsable={false} style={styles.filterDropWrap}>
          <TouchableOpacity
            style={styles.filterBtn}
            accessibilityLabel="Open filters"
            onPress={() => showFilterDropdown ? setShowFilterDropdown(false) : openFilterDropdown()}
          >
            <Ionicons name="filter" size={18} color={C.primary} />
          </TouchableOpacity>

          {showFilterDropdown && (
            <Modal
              transparent
              visible={showFilterDropdown}
              animationType="fade"
              onRequestClose={() => setShowFilterDropdown(false)}
            >
              <View style={styles.filterModalRoot}>
                <TouchableOpacity
                  style={styles.filterModalBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowFilterDropdown(false)}
                />
                <View
                  style={[
                    styles.filterDropMenu,
                    {
                      top: filterMenuPosition.top,
                      left: filterMenuPosition.left,
                      width: filterMenuWidth,
                      height: filterMenuHeight,
                    },
                  ]}
                >
                  <ScrollView
                    style={styles.filterDropScroll}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled
                    bounces={false}
                    directionalLockEnabled
                  >
              {/* REMOVED Clear Filter option */}

              <TouchableOpacity style={styles.filterDropItem} onPress={openDatePicker}>
                <Ionicons name="calendar-outline" size={16} color={C.primary} />
                <Text style={styles.filterDropItemText}>
                  {selectedDateStr ? `Date: ${selectedDateStr}` : 'Select Date'}
                </Text>
                {selectedDateStr && (
                  <TouchableOpacity onPress={clearDateFilter}>
                    <Ionicons name="close-circle" size={16} color={C.danger} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <View style={styles.filterDivider} />

              <TouchableOpacity 
                style={[styles.filterDropItem, selectedPlant === 'all' && styles.filterDropItemActive]} 
                onPress={() => {
                  setSelectedPlant('all');
                  setShowFilterDropdown(false);
                }}
              >
                <Text style={[styles.filterDropItemText, { fontWeight: '500' }, selectedPlant === 'all' && { color: C.primary, fontWeight: '600' }]}>
                  All Plants ({plants.length})
                </Text>
                {selectedPlant === 'all' && (
                  <Ionicons name="checkmark" size={16} color={C.primary} />
                )}
              </TouchableOpacity>

              {plants.map((plant) => (
                <TouchableOpacity 
                  key={plant.name} 
                  style={[styles.filterDropItem, styles.plantItem, selectedPlant === plant.name && styles.filterDropItemActive]}
                  onPress={() => {
                    setSelectedPlant(plant.name);
                    setShowFilterDropdown(false);
                  }}
                >
                  <Text style={[styles.filterDropItemText, { flex: 1 }, selectedPlant === plant.name && { color: C.primary, fontWeight: '600' }]}>
                    {plant.name}
                  </Text>
                  <Text style={styles.filterDropCount}>{plant.totalServices}</Text>
                  {selectedPlant === plant.name && (
                    <Ionicons name="checkmark" size={14} color={C.primary} />
                  )}
                </TouchableOpacity>
              ))}

              <View style={styles.filterDivider} />

              <TouchableOpacity 
                style={[styles.filterDropItem, selectedDistrict === 'all' && styles.filterDropItemActive]}
                onPress={() => {
                  setSelectedDistrict('all');
                  setShowFilterDropdown(false);
                }}
              >
                <Text style={[styles.filterDropItemText, selectedDistrict === 'all' && { color: C.primary, fontWeight: '600' }]}>
                  All Districts
                </Text>
                {selectedDistrict === 'all' && (
                  <Ionicons name="checkmark" size={16} color={C.primary} />
                )}
              </TouchableOpacity>

              {districts.filter(d => d !== 'all').map(district => (
                <TouchableOpacity 
                  key={district} 
                  style={[styles.filterDropItem, styles.districtItem, selectedDistrict === district && styles.filterDropItemActive]}
                  onPress={() => {
                    setSelectedDistrict(district);
                    setShowFilterDropdown(false);
                  }}
                >
                  <Text style={[styles.filterDropItemText, selectedDistrict === district && { color: C.primary, fontWeight: '600' }]}>
                    {district}
                  </Text>
                  {selectedDistrict === district && (
                    <Ionicons name="checkmark" size={14} color={C.primary} />
                  )}
                </TouchableOpacity>
              ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={C.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={14} color={C.text3} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusDropWrap}>
          <TouchableOpacity style={styles.statusBtn} onPress={() => setShowStatusDropdown(!showStatusDropdown)}>
            <Text style={styles.statusBtnText}>
              {selectedStatus === 'all' ? 'All' : selectedStatus === 'pending' ? 'Pending' : 'Completed'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={C.text2} />
          </TouchableOpacity>

          {showStatusDropdown && (
            <View style={styles.statusDropMenu}>
              <TouchableOpacity 
                style={[styles.statusDropItem, selectedStatus === 'all' && styles.statusDropItemActive]} 
                onPress={() => { setSelectedStatus('all'); setShowStatusDropdown(false); }}
              >
                <Text style={[styles.statusDropItemText, selectedStatus === 'all' && styles.statusDropItemTextActive]}>All ({statusCounts.all})</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.statusDropItem, selectedStatus === 'pending' && styles.statusDropItemActive]} 
                onPress={() => { setSelectedStatus('pending'); setShowStatusDropdown(false); }}
              >
                <Text style={[styles.statusDropItemText, selectedStatus === 'pending' && styles.statusDropItemTextActive]}>Pending ({statusCounts.pending})</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.statusDropItem, selectedStatus === 'completed' && styles.statusDropItemActive]} 
                onPress={() => { setSelectedStatus('completed'); setShowStatusDropdown(false); }}
              >
                <Text style={[styles.statusDropItemText, selectedStatus === 'completed' && styles.statusDropItemTextActive]}>Completed ({statusCounts.completed})</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.resultsCount}>
        <Text style={styles.resultsCountText}>{filteredPlants.length} Results found</Text>
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
                value={dateDraft}
                mode="date"
                display="spinner"
                onChange={onDateChange}
              />
              <View style={styles.datePickerActions}>
                <TouchableOpacity style={styles.datePickerAction} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerAction}
                  onPress={() => {
                    applyDateFilter(dateDraft);
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
          value={dateDraft}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      ))}

      <FlatList
        data={filteredPlants}
        renderItem={renderPlant}
        keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="leaf-outline" size={52} color={C.border} />
            <Text style={styles.emptyTitle}>No plants found</Text>
            <Text style={styles.emptySub}>Try adjusting your filters</Text>
          </View>
        }
      />

      <Modal
        visible={showBottomSheet}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBottomSheet(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Service Details</Text>
              <TouchableOpacity onPress={() => setShowBottomSheet(false)}>
                <Ionicons name="close" size={24} color={C.text2} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.bottomSheetScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {selectedService && (
                <View style={styles.bottomSheetContent}>
                  <View style={styles.sheetInfoCard}>
                    <View style={styles.sheetInfoRow}>
                      <Text style={styles.sheetInfoLabel}>SR ID</Text>
                      <Text style={[styles.sheetInfoValue, { color: C.primary, fontWeight: '700' }]}>SR-{selectedService.id}</Text>
                    </View>
                    <View style={styles.sheetInfoRow}>
                      <Text style={styles.sheetInfoLabel}>Plant</Text>
                      <Text style={styles.sheetInfoValue}>{selectedService.plant}</Text>
                    </View>
                    <View style={styles.sheetInfoRow}>
                      <Text style={styles.sheetInfoLabel}>Request Date</Text>
                      <Text style={styles.sheetInfoValue}>{formatDate(selectedService.date)}</Text>
                    </View>
                    {(() => {
                      const sSt = getServiceStatus(selectedService);
                      return (
                        <View style={styles.sheetInfoRow}>
                          <Text style={styles.sheetInfoLabel}>Status</Text>
                          <View style={[styles.sheetInfoBadge, { backgroundColor: sSt.bg }]}>
                            <Text style={[styles.sheetInfoBadgeText, { color: sSt.color }]}>{sSt.text}</Text>
                          </View>
                        </View>
                      );
                    })()}
                    {selectedService.problem && selectedService.problem !== '-' && (
                      <View style={[styles.sheetInfoRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.sheetInfoLabel}>Problem</Text>
                        <Text style={[styles.sheetInfoValue, { flex: 1 }]}>{selectedService.problem}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.sheetEqSectionTitle}>
                    Equipment ({selectedService.equipmentList?.length || 0})
                  </Text>

                  {selectedService.equipmentList?.map((eq, idx) => renderEquipmentInSheet(eq, idx))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { marginTop: 10, color: C.text2, fontSize: 14 },

  // Header styles removed - now handled by App.js

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginTop: 6,
    zIndex: 10,
    elevation: 10,
  },
  filterDropWrap: { position: 'relative', zIndex: 300, elevation: 20 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  filterModalRoot: { flex: 1 },
  filterModalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  filterDropMenu: {
    position: 'absolute',
    top: 35,
    left: 0,
    backgroundColor: C.white,
    borderRadius: 10,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 250,
    maxHeight: SCREEN_HEIGHT * 0.55,
    zIndex: 301,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  filterDropScroll: { flex: 1 },
  filterDropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterDropItemActive: { backgroundColor: C.primaryLight },
  filterDropItemText: { fontSize: 13, color: C.text1, flex: 1 },
  filterDropCount: {
    fontSize: 11,
    color: C.text3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  plantItem: { paddingLeft: 24 },
  districtItem: { paddingLeft: 24 },
  filterDivider: { height: 1, backgroundColor: '#E9ECEF', marginVertical: 4 },
  datePickerOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  datePickerContainer: { backgroundColor: C.white, borderRadius: 12, padding: 16 },
  datePickerTitle: { fontSize: 16, fontWeight: '700', color: C.text1, marginBottom: 8 },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  datePickerAction: { paddingHorizontal: 14, paddingVertical: 9 },
  datePickerCancelText: { color: C.text2, fontSize: 13, fontWeight: '600' },
  datePickerConfirmText: { color: C.primary, fontSize: 13, fontWeight: '700' },

  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text1, padding: 0 },

  statusDropWrap: { position: 'relative', zIndex: 199 },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusBtnText: { fontSize: 12, color: C.text2, fontWeight: '500' },
  statusDropMenu: {
    position: 'absolute',
    top: 35,
    right: 0,
    backgroundColor: C.white,
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    minWidth: 150,
    zIndex: 300,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  statusDropItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusDropItemActive: { backgroundColor: C.primaryLight },
  statusDropItemText: { fontSize: 13, color: C.text2 },
  statusDropItemTextActive: { color: C.primary, fontWeight: '600' },

  resultsCount: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  resultsCountText: { fontSize: 11, color: C.text3, fontWeight: '500' },

  listContent: { padding: 14, paddingBottom: 30, paddingTop: 0 },

  plantCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  plantCardHighlighted: {
    backgroundColor: C.primaryHighlight,
    borderColor: C.primary,
    borderWidth: 2,
  },
  plantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  plantName: { fontSize: 15, fontWeight: '700', color: C.text1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText: { fontSize: 11, color: C.text3 },
  plantStatusBadge: {
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  plantStatusText: { fontSize: 10, fontWeight: '600' },

  tableWrap: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 7,
    marginTop: 4,
    marginBottom: 2,
  },
  thCell: { fontSize: 11, fontWeight: '600', color: C.text3 },
  tableSrColumn: { flex: 1.1, minWidth: 0 },
  tableDateColumn: { flex: 1.2, minWidth: 0 },
  tableEquipmentColumn: { flex: 1, minWidth: 0, textAlign: 'center' },
  tableStatusColumn: { flex: 1.3, minWidth: 0, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tdCell: { fontSize: 12, color: C.text1 },
  statusText: { fontSize: 11, fontWeight: '500' },
  noDataRow: { paddingVertical: 18, alignItems: 'center' },
  noDataText: { fontSize: 12, color: C.text3 },

  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, color: C.text2, fontWeight: '600', marginTop: 14 },
  emptySub: { fontSize: 12, color: C.text3, marginTop: 4 },

  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.7,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text1,
  },
  bottomSheetScrollView: {
    flex: 1,
  },
  bottomSheetContent: {
    paddingBottom: 30,
  },

  sheetInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  sheetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sheetInfoLabel: { fontSize: 12, color: C.text3, fontWeight: '500', width: 100 },
  sheetInfoValue: { fontSize: 13, color: C.text1, flex: 1 },
  sheetInfoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  sheetInfoBadgeText: { fontSize: 11, fontWeight: '600' },

  sheetEqSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text2,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },

  sheetEqCard: {
    backgroundColor: C.white,
    borderRadius: 11,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  sheetEqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 10,
  },
  sheetEqName: { fontSize: 14, fontWeight: '600', color: C.text1 },
  sheetEqModel: { fontSize: 11, color: C.text3, marginTop: 2 },
  sheetEqStatusBadge: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  sheetEqStatusText: { fontSize: 11, fontWeight: '600' },

  sheetEqDetails: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 13,
    paddingTop: 11,
    gap: 8,
  },
  sheetEqDetailRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetEqDetailLabel: { fontSize: 11, color: C.text3, fontWeight: '500', width: 100 },
  sheetEqDetailValue: { fontSize: 12, color: C.text1, flex: 1 },

  sheetPartsWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  sheetPartsTitle: { fontSize: 11, fontWeight: '700', color: C.text2, marginBottom: 8 },
  sheetPartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sheetPartName: { fontSize: 12, color: C.text1, flex: 1 },
  sheetPartMeta: { fontSize: 11, color: C.primary, fontWeight: '600' },

  sheetAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  sheetAttachBtnText: { fontSize: 12, color: C.primary, fontWeight: '500', maxWidth: 200 },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadProgressText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '500',
  },
});