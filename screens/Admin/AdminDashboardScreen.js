import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const REPORT_TABS = ['district', 'revenue', 'status'];
const API_BASE = 'http://192.168.29.223:2927/api';
//const API_BASE = 'http://10.196.32.8:2927/api';

const getPieSlicePath = (center, radius, startAngle, endAngle) => {
  const toPoint = (angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  if (endAngle - startAngle >= 359.999) {
    return `M ${center - radius} ${center} A ${radius} ${radius} 0 1 0 ${center + radius} ${center} A ${radius} ${radius} 0 1 0 ${center - radius} ${center} Z`;
  }

  const start = toPoint(startAngle);
  const end = toPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

const InteractivePieChart = ({ data, width: chartWidth, height: chartHeight, onSlicePress }) => {
  const total = data.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const pieSize = Math.min(chartHeight, chartWidth * 0.58);
  const center = pieSize / 2;
  const radius = pieSize * 0.42;
  let startAngle = -90;

  const slices = data.map((item) => {
    const sliceAngle = total > 0 ? (Number(item.count || 0) / total) * 360 : 0;
    const sliceStartAngle = startAngle;
    const path = sliceAngle > 0
      ? getPieSlicePath(center, radius, sliceStartAngle, sliceStartAngle + sliceAngle)
      : null;
    startAngle += sliceAngle;
    return { item, path, startAngle: sliceStartAngle, endAngle: sliceStartAngle + sliceAngle };
  });

  const handlePieTouch = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const offsetX = locationX - center;
    const offsetY = locationY - center;

    if (Math.hypot(offsetX, offsetY) > radius) return;

    const touchAngle = (Math.atan2(offsetY, offsetX) * 180 / Math.PI + 450) % 360;
    const touchedSlice = slices.find(({ item, startAngle, endAngle }) =>
      Number(item.count || 0) > 0 && touchAngle >= startAngle + 90 && touchAngle < endAngle + 90
    );

    if (touchedSlice) onSlicePress(touchedSlice.item);
  };

  return (
    <View style={[styles.statusChartContent, { width: chartWidth, height: chartHeight }]}>
      <View style={{ width: pieSize, height: pieSize }}>
        <Svg
          width={pieSize}
          height={pieSize}
          viewBox={`0 0 ${pieSize} ${pieSize}`}
          pointerEvents="none"
        >
          {total > 0 ? slices.filter(slice => slice.path).map(({ item, path }) => (
            <Path key={item.code} d={path} fill={item.color} />
          )) : (
            <Path
              d={getPieSlicePath(center, radius, -90, 270)}
              fill="#E2E8F0"
            />
          )}
        </Svg>
        {total > 0 && (
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onResponderRelease={handlePieTouch}
          />
        )}
      </View>
      <View style={styles.statusChartLegend}>
        {data.map(item => (
          <View
            key={item.code}
            style={styles.statusChartLegendItem}
          >
            <View style={[styles.statusChartLegendDot, { backgroundColor: item.color }]} />
            <Text style={styles.statusChartLegendText}>
              {item.count} {item.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};


// Custom Horizontal Bar Chart Component
const HorizontalBarChart = ({ data, onBarPress }) => {
  const maxValue = Math.max(...data.map(item => item.count), 1);
  
  return (
    <View style={styles.horizontalChartContainer}>
      {data.map((item, index) => (
        <TouchableOpacity 
          key={index} 
          style={styles.horizontalBarRow}
          onPress={() => onBarPress(item.districtName)}
          activeOpacity={0.7}
        >
          <Text style={styles.horizontalBarLabel} numberOfLines={1}>
            {item.districtName}
          </Text>
          <View style={styles.horizontalBarWrapper}>
            <View 
              style={[
                styles.horizontalBar, 
                { width: `${(item.count / maxValue) * 70}%` }
              ]} 
            />
            <Text style={styles.horizontalBarValue}>{item.count}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const RevenueBarChart = ({ data, width: chartWidth, formatMonth, formatValue, onBarPress }) => {
  const maxValue = Math.max(...data.map(item => Number(item.revenue) || 0), 1);
  const plotHeight = 136;
  const tickValues = [maxValue, maxValue * 2 / 3, maxValue / 3, 0];

  return (
    <View style={[styles.revenueBarChart, { width: chartWidth }]}>
      <View style={styles.revenueBarChartBody}>
        <View style={[styles.revenueYAxis, { height: plotHeight }]}>
          {tickValues.map((value, index) => (
            <Text key={index} style={styles.revenueYAxisLabel} numberOfLines={1}>
              {formatValue(value)}
            </Text>
          ))}
        </View>
        <View style={styles.revenuePlotColumn}>
          <View style={[styles.revenuePlot, { height: plotHeight }]}>
            {tickValues.map((_, index) => (
              <View
                key={index}
                style={[styles.revenueGridLine, { top: (plotHeight - 1) * index / (tickValues.length - 1) }]}
              />
            ))}
            <View style={styles.revenueBars}>
              {data.map((item, index) => {
                const value = Number(item.revenue) || 0;
                const barHeight = Math.max((value / maxValue) * plotHeight, value > 0 ? 4 : 0);
                const month = formatMonth(item).split(' ')[0];

                return (
                  <TouchableOpacity
                    key={item.monthKey || item.month || index}
                    style={styles.revenueBarColumn}
                    onPress={() => onBarPress(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${month}, ${formatValue(value)} revenue`}
                  >
                    <View style={[styles.revenueBar, { height: barHeight }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.revenueMonthLabels}>
            {data.map((item, index) => (
              <Text key={item.monthKey || item.month || index} style={styles.revenueMonthLabel} numberOfLines={1}>
                {formatMonth(item).split(' ')[0]}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default function AdminDashboardScreen({ navigation, onNavigateToTab }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState('district');
  const selectedReportRef = useRef('district');
  const reportSlide = useRef(new Animated.Value(0)).current;
  
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [dashboardData, setDashboardData] = useState({
    totalCustomers: 0,
    totalPlants: 0,
    totalServices: 0,
    totalRevenue: 0,
    openServices: 0,
    assignedServices: 0,
    completedToday: 0,
    completedOverall: 0,
    districtWiseServices: [],
    monthlyRevenue: [],
    serviceStatus: { completed: 0, assigned: 0, open: 0 },
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsRes, tasksRes, districtRes, revenueRes, statusRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/dashboard/stats`),
        axios.get(`${API_BASE}/admin/dashboard/pending-tasks`),
        axios.get(`${API_BASE}/admin/dashboard/district-wise-services`),
        axios.get(`${API_BASE}/admin/dashboard/monthly-revenue`),
        axios.get(`${API_BASE}/admin/dashboard/service-status`),
      ]);

      setDashboardData({
        totalCustomers: statsRes.data.total_customers || 0,
        totalPlants: statsRes.data.total_plants || 0,
        totalServices: statsRes.data.total_services || 0,
        totalRevenue: statsRes.data.total_revenue || 0,
        openServices: tasksRes.data.openServices || 0,
        assignedServices: tasksRes.data.assignedServices || 0,
        completedToday: tasksRes.data.completedToday || 0,
        completedOverall: statusRes.data?.completed || 0,
        districtWiseServices: districtRes.data.districtWiseServices || districtRes.data.districts || [],
        monthlyRevenue: revenueRes.data.months || revenueRes.data || [],
        serviceStatus: statusRes.data || { completed: 0, assigned: 0, open: 0 },
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const changeReport = (nextReport) => {
    const currentReport = selectedReportRef.current;
    if (nextReport === currentReport) return;

    const direction = REPORT_TABS.indexOf(nextReport) > REPORT_TABS.indexOf(currentReport) ? 1 : -1;
    selectedReportRef.current = nextReport;
    reportSlide.stopAnimation();
    reportSlide.setValue(direction * width * 0.55);
    setSelectedReport(nextReport);
    Animated.timing(reportSlide, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const reportPanResponder = useRef(null);
  if (!reportPanResponder.current) {
    const shouldCaptureHorizontalSwipe = (_, gestureState) =>
      Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;

    reportPanResponder.current = PanResponder.create({
      onMoveShouldSetPanResponderCapture: shouldCaptureHorizontalSwipe,
      onMoveShouldSetPanResponder: shouldCaptureHorizontalSwipe,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 55 || Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) return;

        const currentIndex = REPORT_TABS.indexOf(selectedReportRef.current);
        const nextIndex = Math.max(0, Math.min(
          REPORT_TABS.length - 1,
          currentIndex + (gestureState.dx < 0 ? 1 : -1)
        ));
        if (nextIndex !== currentIndex) changeReport(REPORT_TABS[nextIndex]);
      },
    });
  }

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    let num = parseFloat(amount);
    if (isNaN(num)) return '₹0';
    let str = Math.round(num).toString();
    let lastThree = str.slice(-3);
    let otherNumbers = str.slice(0, -3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    let result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return `₹${result}`;
  };

  const formatCompactCurrency = (value) => {
    const amount = Number(value) || 0;
    const absoluteAmount = Math.abs(amount);
    const compact = (divisor, suffix) => `${Number((amount / divisor).toFixed(1))}${suffix}`;

    if (absoluteAmount >= 10000000) return `₹${compact(10000000, 'Cr')}`;
    if (absoluteAmount >= 100000) return `₹${compact(100000, 'L')}`;
    if (absoluteAmount >= 1000) return `₹${compact(1000, 'k')}`;
    return `₹${Math.round(amount)}`;
  };

  const handleDistrictClick = async (districtName) => {
    setModalTitle(`${districtName} - Services`);
    setModalLoading(true);
    setShowModal(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/services/by-district/${encodeURIComponent(districtName)}`);
      setModalData(res.data.services || []);
    } catch (error) {
      setModalData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleRevenueClick = async (month, year, revenue) => {
    const monthNumber = Number(month);
    const monthLabel = monthNumber >= 1 && monthNumber <= 12
      ? new Date(Number(year), monthNumber - 1, 1).toLocaleString('en-US', { month: 'short' })
      : String(month).substring(0, 3);
    setModalTitle(`${monthLabel} ${year} · ${formatCurrency(revenue)} · Services`);
    setModalLoading(true);
    setShowModal(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/services/by-month`, { 
        params: { year: year, month: month } 
      });
      setModalData(res.data.services || []);
    } catch (error) {
      setModalData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeServicesModal = () => {
    setShowDetailModal(false);
    setShowModal(false);
  };

  const handleStatusClick = async (status) => {
    const statusName = typeof status === 'string' ? status : status.name;
    const statusCode = typeof status === 'string'
      ? { Open: 'O', Assigned: 'A', Completed: 'C' }[status]
      : status.code;

    if (!statusCode) {
      console.error('Unsupported dashboard service status:', statusName);
      return;
    }
    
    setModalTitle(`${statusName} Services`);
    setModalLoading(true);
    setShowModal(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/services/by-status-code/${statusCode}`);
      setModalData(res.data.services || []);
    } catch (error) {
      setModalData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleServiceDetail = async (srid) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/services/${srid}`);
      setDetailData(res.data);
    } catch (error) {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const getSortedDistricts = () => {
    const districts = dashboardData.districtWiseServices || [];
    return [...districts].sort((a, b) => b.count - a.count);
  };

  const formatRevenueMonth = (item) => {
    if (item.monthKey) {
      const [year, month] = item.monthKey.split('-').map(Number);
      if (year && month >= 1 && month <= 12) {
        const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
        return `${monthLabel} ${year}`;
      }
    }
    return item.month || '';
  };

  // ✅ FIXED STATUS COLORS
  const statusData = [
    { name: 'Open', count: dashboardData.serviceStatus?.open || 0, color: '#10B981', code: 'O' },
    { name: 'Assigned', count: dashboardData.serviceStatus?.assigned || 0, color: '#F59E0B', code: 'A' },
    { name: 'Completed', count: dashboardData.serviceStatus?.completed || 0, color: '#EF4444', code: 'C' },
  ];

  const StatCard = ({ title, value, icon, color, onPress }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '10' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  // ✅ CORRECT STATUS COLOR FUNCTION
  const getStatusColor = (status) => {
    if (status === 'C') return '#EF4444';     // Completed - Red
    if (status === 'A') return '#F59E0B';     // Assigned - Orange
    if (status === 'P') return '#F59E0B';     // Assigned - Orange
    if (status === 'O') return '#10B981';     // Open - Green
    return '#10B981';
  };

  const getStatusText = (status) => {
    if (status === 'C') return 'Completed';
    if (status === 'A') return 'Assigned';
    if (status === 'P') return 'Assigned';
    if (status === 'O') return 'Open';
    return 'Open';
  };

  const getServiceRequestStatus = (service) => {
    const equipmentStatuses = service?.equipments?.map(equipment => equipment.status).filter(Boolean) || [];

    if (equipmentStatuses.length > 0) {
      if (equipmentStatuses.every(status => status === 'C')) return 'C';
      if (equipmentStatuses.some(status => status === 'O')) return 'O';
      if (equipmentStatuses.some(status => status === 'A' || status === 'P')) return 'A';
    }

    return service?.serviceRequestStatus;
  };

  // ✅ IMPROVED TABLE ROW with proper alignment
  const ServiceTableRow = ({ item, onPress }) => {
    // Get correct status for display
    const displayStatus = getStatusText(item.status);
    const statusColor = getStatusColor(item.status);
    
    return (
      <TouchableOpacity style={styles.modalTableRow} onPress={() => onPress(item.srid)} activeOpacity={0.7}>
        <View style={styles.cellId}>
          <Text style={styles.cellIdText} numberOfLines={1}>SR-{item.srid}</Text>
        </View>
        <View style={styles.cellPlant}>
          <Text style={styles.cellPlantText} numberOfLines={2}>{item.plantName || item.customerName || '-'}</Text>
        </View>
        <View style={styles.cellStatus}>
          <Text style={[styles.cellStatusText, { color: statusColor }]} numberOfLines={1}>
            {displayStatus}
          </Text>
        </View>
        <View style={styles.cellDate}>
          <Text style={styles.cellDateText} numberOfLines={1}>{formatDateOnly(item.requestDate)}</Text>
        </View>
        <View style={styles.cellArrow}>
          <Feather name="chevron-right" size={16} color="#cbd5e1" />
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ IMPROVED TABLE HEADER with proper alignment
  const ModalTableHeader = () => (
    <View style={styles.modalTableHeader}>
      <View style={styles.headerId}>
        <Text style={styles.headerText}>SR ID</Text>
      </View>
      <View style={styles.headerPlant}>
        <Text style={styles.headerText}>Plant</Text>
      </View>
      <View style={styles.headerStatus}>
        <Text style={styles.headerText}>Status</Text>
      </View>
      <View style={styles.headerDate}>
        <Text style={styles.headerText}>Request Date</Text>
      </View>
      <View style={styles.headerArrow} />
    </View>
  );

  // Parts Table Components
  const PartsTableHeader = () => (
    <View style={styles.partsTableHeader}>
      <Text style={[styles.partsHeaderText, styles.partsHeaderName]}>Part Name</Text>
      <Text style={[styles.partsHeaderText, styles.partsHeaderQty]}>Qty</Text>
      <Text style={[styles.partsHeaderText, styles.partsHeaderRate]}>Rate</Text>
      <Text style={[styles.partsHeaderText, styles.partsHeaderTotal]}>Total</Text>
    </View>
  );

  const PartsTableRow = ({ part, index }) => {
    const total = (part.quantity || 0) * (part.rate || 0);
    return (
      <View style={[styles.partsTableRow, index % 2 === 0 ? styles.partsEvenRow : styles.partsOddRow]}>
        <Text style={[styles.partsCell, styles.partsCellName]} numberOfLines={1}>{part.partName}</Text>
        <Text style={[styles.partsCell, styles.partsCellQty]}>{part.quantity}</Text>
        <Text style={[styles.partsCell, styles.partsCellRate]}>{formatCurrency(part.rate)}</Text>
        <Text style={[styles.partsCell, styles.partsCellTotal]}>{formatCurrency(total)}</Text>
      </View>
    );
  };

  // Nested Service Detail Sheet
  const ServiceDetailSheet = ({ visible, data, loading, onClose }) => {
    if (!visible) return null;

    return (
        <View style={styles.detailOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            activeOpacity={1}
          />
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Service Details</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.modalCenter}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.modalCenterText}>Loading...</Text>
                </View>
              ) : data ? (
                <View style={styles.detailBody}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Basic Information</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Service ID</Text>
                      <Text style={styles.detailValue}>SR-{data.srid}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Plant</Text>
                      <Text style={styles.detailValue}>{data.plantName || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>District</Text>
                      <Text style={styles.detailValue}>{data.districtName || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Request Date</Text>
                      <Text style={styles.detailValue}>{formatDateOnly(data.requestDate)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <Text style={[styles.detailValue, { color: getStatusColor(getServiceRequestStatus(data)), fontWeight: '600' }]}>
                        {getStatusText(getServiceRequestStatus(data))}
                      </Text>
                    </View>
                    {data.problem && data.problem !== '-' && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Problem</Text>
                        <Text style={styles.detailValue}>{data.problem}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.detailSectionTitle}>Equipment Details</Text>
                  {data.equipments && data.equipments.length > 0 ? (
                    data.equipments.map((eq, idx) => {
                      const serviceRateAmount = eq.serviceRate || 0;
                      const partsTotal = eq.parts?.reduce((sum, p) => sum + ((p.quantity || 0) * (p.rate || 0)), 0) || 0;
                      const equipmentTotal = serviceRateAmount + partsTotal;
                      
                      return (
                        <View key={idx} style={styles.detailEquipmentCard}>
                          <View style={styles.detailEquipmentHeader}>
                            <Text style={styles.detailEquipmentName}>{eq.equipmentName || '-'}</Text>
                            <Text style={[styles.detailEquipmentStatus, { color: getStatusColor(eq.status) }]}>
                              {getStatusText(eq.status)}
                            </Text>
                          </View>
                          
                          <View style={styles.detailEquipmentBody}>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Model Number</Text>
                              <Text style={styles.detailValue}>{eq.modelNumber || '-'}</Text>
                            </View>
                            
                            {eq.serviceTypeName && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Service Type</Text>
                                <Text style={styles.detailValue}>{eq.serviceTypeName}</Text>
                              </View>
                            )}
                            
                            {eq.issueName && eq.issueName !== '-' && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Issue</Text>
                                <Text style={styles.detailValue}>{eq.issueName}</Text>
                              </View>
                            )}
                            
                            {eq.remarks && eq.remarks !== '-' && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Remarks</Text>
                                <Text style={styles.detailValue}>{eq.remarks}</Text>
                              </View>
                            )}
                            
                            {eq.serviceDate && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Service Date</Text>
                                <Text style={styles.detailValue}>{formatDateOnly(eq.serviceDate)}</Text>
                              </View>
                            )}
                            
                            {serviceRateAmount > 0 && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Service Rate</Text>
                                <Text style={[styles.detailValue, { color: '#1976d2', fontWeight: '500' }]}>
                                  {formatCurrency(serviceRateAmount)}
                                </Text>
                              </View>
                            )}
                            
                            {(eq.status === 'A' || eq.status === 'P') && eq.servicedByName && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Assigned To</Text>
                                <Text style={[styles.detailValue, { color: '#F59E0B', fontWeight: '500' }]}>
                                  {eq.servicedByName}
                                </Text>
                              </View>
                            )}
                            
                            {eq.status === 'C' && eq.servicedByName && (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Completed By</Text>
                                <Text style={[styles.detailValue, { color: '#EF4444', fontWeight: '500' }]}>
                                  {eq.servicedByName}
                                </Text>
                              </View>
                            )}
                            
                            {eq.parts && eq.parts.length > 0 && (
                              <View style={styles.detailPartsContainer}>
                                <Text style={styles.detailPartsTitle}>Parts Used ({eq.parts.length})</Text>
                                <PartsTableHeader />
                                {eq.parts.map((part, pIdx) => (
                                  <PartsTableRow key={pIdx} part={part} index={pIdx} />
                                ))}
                                <View style={styles.detailPartsTotal}>
                                  <Text style={styles.detailTotalLabel}>Parts Total</Text>
                                  <Text style={styles.detailTotalAmount}>{formatCurrency(partsTotal)}</Text>
                                </View>
                              </View>
                            )}
                            
                            {equipmentTotal > 0 && (
                              <View style={styles.detailGrandTotal}>
                                <Text style={styles.detailGrandTotalLabel}>Equipment Total</Text>
                                <Text style={styles.detailGrandTotalAmount}>{formatCurrency(equipmentTotal)}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.detailNoEquipment}>
                      <Text style={styles.detailNoEquipmentText}>No equipment details available</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.modalCenter}>
                  <MaterialIcons name="error-outline" size={50} color="#cbd5e1" />
                  <Text style={styles.modalCenterText}>Failed to load details</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  const sortedDistricts = getSortedDistricts();
  const revenueMonths = dashboardData.monthlyRevenue || [];
  const revenuePeriodLabel = revenueMonths.length
    ? `${formatRevenueMonth(revenueMonths[0])} – ${formatRevenueMonth(revenueMonths[revenueMonths.length - 1])}`
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <StatCard title="Customers" value={dashboardData.totalCustomers} icon="people-outline" color="#3b82f6" onPress={() => onNavigateToTab?.('customers')} />
          <StatCard title="Plants" value={dashboardData.totalPlants} icon="business-outline" color="#22c55e" onPress={() => onNavigateToTab?.('plants')} />
          <StatCard title="Services" value={dashboardData.totalServices} icon="settings-outline" color="#f59e0b" onPress={() => onNavigateToTab?.('services')} />
          <StatCard title="Revenue" value={formatCurrency(dashboardData.totalRevenue)} icon="cash-outline" color="#8b5cf6" />
        </View>

        {/* Report Selector */}
        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownLabel}>Select Report</Text>
          <View style={styles.dropdownWrapper} {...reportPanResponder.current.panHandlers}>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedReport === 'district' && styles.dropdownItemActive]}
              onPress={() => changeReport('district')}
            >
              <Text style={[styles.dropdownText, selectedReport === 'district' && styles.dropdownTextActive]}>District Wise</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedReport === 'revenue' && styles.dropdownItemActive]}
              onPress={() => changeReport('revenue')}
            >
              <Text style={[styles.dropdownText, selectedReport === 'revenue' && styles.dropdownTextActive]}>Revenue Trend</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedReport === 'status' && styles.dropdownItemActive]}
              onPress={() => changeReport('status')}
            >
              <Text style={[styles.dropdownText, selectedReport === 'status' && styles.dropdownTextActive]}>Status Wise</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.chartSection} {...reportPanResponder.current.panHandlers}>
          <Animated.View
            style={[
              styles.reportContent,
              { transform: [{ translateX: reportSlide }] },
            ]}
          >
          {selectedReport === 'district' && sortedDistricts.length > 0 ? (
            <>
              <Text style={styles.chartTitle}>Services by District</Text>
              <Text style={styles.chartSubtitle}>Tap on any bar to view services</Text>
              <HorizontalBarChart 
                data={sortedDistricts} 
                onBarPress={handleDistrictClick}
              />
            </>
          ) : selectedReport === 'district' && (
            <View style={styles.emptyState}>
              <MaterialIcons name="bar-chart" size={50} color="#e2e8f0" />
              <Text style={styles.emptyText}>No district data available</Text>
            </View>
          )}

          {selectedReport === 'revenue' && revenueMonths.length > 0 ? (
            <>
              <Text style={styles.chartTitle}>Monthly Revenue Trend</Text>
              <Text style={styles.chartSubtitle}>
                {revenuePeriodLabel} · Completed services · Tap a bar for details
              </Text>
              <RevenueBarChart
                data={revenueMonths}
                width={width - 64}
                formatMonth={formatRevenueMonth}
                formatValue={formatCompactCurrency}
                onBarPress={(item) => {
                  let year = '', month = '';
                  if (item.monthKey) {
                    [year, month] = item.monthKey.split('-');
                  } else if (item.month) {
                    const parts = item.month.split(' ');
                    month = parts[0];
                    year = parts[1];
                  }
                  if (year && month) {
                    handleRevenueClick(month, year, item.revenue);
                  }
                }}
              />
              <View style={styles.revenueStats}>
                <View style={styles.revenueStat}>
                  <Text style={styles.revenueStatLabel}>Highest month</Text>
                  <Text style={styles.revenueStatValue}>{formatCurrency(Math.max(...revenueMonths.map(r => r.revenue || 0)))}</Text>
                </View>
                <View style={styles.revenueStat}>
                  <Text style={styles.revenueStatLabel}>Monthly average</Text>
                  <Text style={styles.revenueStatValue}>{formatCurrency(revenueMonths.reduce((s, r) => s + (r.revenue || 0), 0) / revenueMonths.length)}</Text>
                </View>
                <View style={styles.revenueStat}>
                  <Text style={styles.revenueStatLabel}>Total for period</Text>
                  <Text style={styles.revenueStatValue}>{formatCurrency(revenueMonths.reduce((s, r) => s + (r.revenue || 0), 0))}</Text>
                </View>
              </View>
            </>
          ) : selectedReport === 'revenue' && (
            <View style={styles.emptyState}>
              <MaterialIcons name="show-chart" size={50} color="#e2e8f0" />
              <Text style={styles.emptyText}>No revenue data available</Text>
            </View>
          )}

          {selectedReport === 'status' && (
            <>
              <Text style={styles.chartTitle}>Service Status Distribution</Text>
              <Text style={styles.chartSubtitle}>Tap on any slice to view services</Text>
              <InteractivePieChart
                data={statusData}
                width={width - 48}
                height={220}
                onSlicePress={handleStatusClick}
              />
            </>
          )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Services List Modal - IMPROVED TABLE */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => showDetailModal ? setShowDetailModal(false) : closeServicesModal()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={closeServicesModal}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            {modalLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.modalCenterText}>Loading services...</Text>
              </View>
            ) : modalData.length > 0 ? (
              <FlatList
                data={modalData}
                renderItem={({ item }) => <ServiceTableRow item={item} onPress={handleServiceDetail} />}
                keyExtractor={(item) => item.srid?.toString() || Math.random().toString()}
                contentContainerStyle={styles.modalList}
                ListHeaderComponent={<ModalTableHeader />}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.modalCenter}>
                <MaterialIcons name="info-outline" size={50} color="#e2e8f0" />
                <Text style={styles.modalCenterText}>No services found</Text>
              </View>
            )}
            <ServiceDetailSheet
              visible={showDetailModal}
              data={detailData}
              loading={detailLoading}
              onClose={() => setShowDetailModal(false)}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  
  // Header
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  
  // Stats
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statInfo: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  statTitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  
  // Dropdown
  dropdownContainer: { paddingHorizontal: 16, paddingTop: 12 },
  dropdownLabel: { fontSize: 13, fontWeight: '500', color: '#64748b', marginBottom: 8 },
  dropdownWrapper: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  dropdownItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  dropdownItemActive: { backgroundColor: '#3b82f6' },
  dropdownText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  dropdownTextActive: { color: '#fff' },
  
  // Chart
  chartSection: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, marginBottom: 20, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  reportContent: { width: '100%' },
  chartTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', textAlign: 'center' },
  chartSubtitle: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 12 },
  revenueBarChart: { marginVertical: 8, alignSelf: 'center' },
  revenueBarChartBody: { flexDirection: 'row', alignItems: 'center' },
  revenueYAxis: { width: 52, justifyContent: 'space-between', paddingVertical: 2, marginRight: 8 },
  revenueYAxisLabel: { fontSize: 9, color: '#64748b', textAlign: 'right' },
  revenuePlotColumn: { flex: 1, minWidth: 0 },
  revenuePlot: { position: 'relative', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  revenueGridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#e2e8f0' },
  revenueBars: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingHorizontal: 2 },
  revenueBarColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  revenueBar: { width: 20, backgroundColor: '#3b82f6', borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  revenueMonthLabels: { flexDirection: 'row', paddingHorizontal: 2, marginTop: 8 },
  revenueMonthLabel: { flex: 1, minWidth: 0, fontSize: 10, color: '#64748b', textAlign: 'center' },
  
  horizontalChartContainer: { marginTop: 10, marginBottom: 10 },
  horizontalBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  horizontalBarLabel: { width: 100, fontSize: 13, color: '#334155', fontWeight: '500' },
  horizontalBarWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  horizontalBar: { height: 28, backgroundColor: '#3b82f6', borderRadius: 6, minWidth: 4 },
  horizontalBarValue: { marginLeft: 10, fontSize: 13, fontWeight: '600', color: '#3b82f6', width: 35 },
  
  revenueStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  revenueStat: { alignItems: 'center' },
  revenueStatLabel: { fontSize: 10, color: '#64748b' },
  revenueStatValue: { fontSize: 12, fontWeight: '600', color: '#22c55e', marginTop: 4 },
  
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { marginTop: 12, color: '#94a3b8', fontSize: 14 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: height * 0.68, position: 'relative', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  modalList: { padding: 16 },
  modalCenter: { padding: 50, alignItems: 'center' },
  modalCenterText: { marginTop: 10, color: '#64748b' },
  
  // ✅ IMPROVED TABLE STYLES - Proper column alignment
  modalTableHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 16, 
    columnGap: 8,
    backgroundColor: '#f1f5f9', 
    borderRadius: 10, 
    marginBottom: 8
  },
  headerText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  headerId: { width: (width - 96) * 0.22 },
  headerPlant: { flex: 1, minWidth: 0 },
  headerStatus: { width: (width - 96) * 0.2 },
  headerDate: { width: (width - 96) * 0.24 },
  headerArrow: { width: (width - 96) * 0.06 },
  
  modalTableRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 16,
    columnGap: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  
  cellId: { width: (width - 96) * 0.22 },
  cellPlant: { flex: 1, minWidth: 0 },
  cellStatus: { width: (width - 96) * 0.2 },
  cellDate: { width: (width - 96) * 0.24 },
  cellArrow: { width: (width - 96) * 0.06, alignItems: 'flex-end' },
  
  cellIdText: { fontSize: 12, fontWeight: '600', color: '#3b82f6', flexShrink: 1 },
  cellPlantText: { fontSize: 12, color: '#334155', flexShrink: 1 },
  cellStatusText: { fontSize: 10, fontWeight: '600' },
  cellDateText: { fontSize: 11, color: '#64748b' },
  
  // Parts Table
  partsTableHeader: { flexDirection: 'row', backgroundColor: '#E3F2FD', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  partsHeaderText: { fontSize: 11, fontWeight: '600', color: '#1565C0' },
  partsHeaderName: { flex: 2 },
  partsHeaderQty: { width: 50, textAlign: 'center' },
  partsHeaderRate: { width: 80, textAlign: 'right' },
  partsHeaderTotal: { width: 90, textAlign: 'right' },
  
  partsTableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  partsEvenRow: { backgroundColor: '#fff' },
  partsOddRow: { backgroundColor: '#fafafa' },
  partsCell: { fontSize: 11, color: '#333' },
  partsCellName: { flex: 2 },
  partsCellQty: { width: 50, textAlign: 'center', color: '#666' },
  partsCellRate: { width: 80, textAlign: 'right', color: '#666' },
  partsCellTotal: { width: 90, textAlign: 'right', fontWeight: '600', color: '#2e7d32' },
  
  // Detail Modal
  detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 10, elevation: 10 },
  detailModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, width: '100%', maxHeight: '92%', flexShrink: 1, overflow: 'hidden' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  detailBody: { padding: 16 },
  detailSection: { marginBottom: 20, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14 },
  detailSectionTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', marginBottom: 10 },
  detailLabel: { width: 100, fontSize: 12, color: '#64748b' },
  detailValue: { flex: 1, fontSize: 12, color: '#334155' },
  
  detailEquipmentCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  detailEquipmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  detailEquipmentName: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  detailEquipmentStatus: { fontSize: 12, fontWeight: '600' },
  detailEquipmentBody: { padding: 12 },
  
  detailPartsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  detailPartsTitle: { fontSize: 13, fontWeight: '600', color: '#1976d2', marginBottom: 10 },
  
  detailPartsTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  detailTotalLabel: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  detailTotalAmount: { fontSize: 13, fontWeight: 'bold', color: '#2e7d32' },
  
  detailGrandTotal: { flexDirection: 'row', justifyContent: 'space-between',alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#1976d2', backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingBottom: 10, borderRadius: 8 },
  detailGrandTotalLabel: { fontSize: 13, fontWeight: 'bold', color: '#1565C0' },
  detailGrandTotalAmount: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },
  
  detailNoEquipment: { padding: 30, alignItems: 'center' },
  detailNoEquipmentText: { fontSize: 13, color: '#999' },
  statusChartContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  statusChartLegend: { flex: 1, paddingLeft: 12, gap: 12 },
  statusChartLegendItem: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  statusChartLegendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusChartLegendText: { fontSize: 13, color: '#334155', fontWeight: '500' },
});