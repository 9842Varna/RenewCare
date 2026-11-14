import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

//const API_BASE = 'http://10.196.32.8:2927/api';
const API_BASE = 'http://192.168.29.223:2927/api';
const MAX_PROFILE_IMAGE_SIZE_BYTES = 1024 * 1024;

export default function ProfileScreen({ user, onLogout, hideHeader = true, compact = false, onProfileUpdated }) {
  const profileImageWrapperRef = useRef(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [employeeData, setEmployeeData] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageOptionsModal, setShowImageOptionsModal] = useState(false);
  const [imageOptionsPosition, setImageOptionsPosition] = useState({ top: 0, left: 12 });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    gender: '',
    phone: '',
    email: '',
    address1: '',
    address2: '',
    talukName: '',
  });

  useEffect(() => {
    loadEmployeeProfile();
  }, []);

  const loadEmployeeProfile = async () => {
    try {
      let empId = user?.id;
      if (!empId) {
        const empData = await AsyncStorage.getItem('employeeData');
        if (empData) {
          const data = JSON.parse(empData);
          empId = data.id;
        }
      }
      
      if (empId) {
        const response = await axios.get(`${API_BASE}/profile/${empId}`);
        setEmployeeData(response.data);
        setEditData({
          name: response.data.name || '',
          gender: response.data.gender || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          address1: response.data.address1 || '',
          address2: response.data.address2 || '',
          talukName: response.data.talukName || '',
        });
        
        loadProfileImage(empId);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileImage = async (empId) => {
    try {
      const imageUrl = `${API_BASE}/profile/image/${empId}?t=${Date.now()}`;
      setProfileImage(imageUrl);
    } catch (e) {
      console.error('Error loading image:', e);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Need camera roll permission to upload image');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    
    if (!result.canceled && result.assets?.[0]) {
      uploadProfileImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Need camera permission to take photo');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    
    if (!result.canceled && result.assets?.[0]) {
      uploadProfileImage(result.assets[0]);
    }
  };

  const deleteProfileImage = async () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUploadingImage(true);
            try {
              let empId = user?.id;
              if (!empId) {
                const empData = await AsyncStorage.getItem('employeeData');
                if (empData) {
                  empId = JSON.parse(empData).id;
                }
              }
              
              const response = await axios.post(`${API_BASE}/profile/delete-image`, { empId });
              
              if (response.data.status === 'success') {
                setProfileImage(null);
                onProfileUpdated?.({ profile_pic: null, profileImage: null });
                Alert.alert('Success', 'Profile picture deleted!');
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to delete image');
            } finally {
              setUploadingImage(false);
            }
          }
        }
      ]
    );
  };

  const uploadProfileImage = async (asset) => {
    const uri = asset?.uri;
    if (!uri) {
      Alert.alert('Upload failed', 'The selected photo could not be opened. Please choose another photo.');
      return;
    }

    if (asset.fileSize > MAX_PROFILE_IMAGE_SIZE_BYTES) {
      Alert.alert('Image too large', 'Choose a photo that is 1 MB or smaller.');
      return;
    }

    setUploadingImage(true);
    try {
      let empId = user?.id;
      if (!empId) {
        const empData = await AsyncStorage.getItem('employeeData');
        if (empData) {
          empId = JSON.parse(empData).id;
        }
      }

      if (!empId) {
        Alert.alert('Upload failed', 'Employee ID is missing. Please sign in again and retry.');
        return;
      }
      
      const formData = new FormData();
      const filename = uri.split('/').pop()?.split('?')[0] || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const extension = match?.[1]?.toLowerCase();
      const type = extension === 'png' ? 'image/png' : 'image/jpeg';
      
      formData.append('file', {
        uri,
        name: filename,
        type: type,
      });
      formData.append('empId', empId);
      
      const response = await fetch(`${API_BASE}/profile/update-image`, {
        method: 'POST',
        body: formData,
      });
      const responseText = await response.text();
      let responseData;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { message: responseText };
      }

      if (!response.ok || responseData.status !== 'success') {
        const uploadError = new Error(responseData.message || `Upload failed (${response.status}).`);
        uploadError.status = response.status;
        throw uploadError;
      }

      const imageUrl = `${API_BASE}/profile/image/${empId}?t=${Date.now()}`;
      setProfileImage(imageUrl);
      onProfileUpdated?.({ profile_pic: imageUrl, profileImage: imageUrl });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      const errorStatus = error.status || error.response?.status;
      const errorMessage = error.message || 'Please try again.';
      const sizeLimitExceeded = errorStatus === 413
        || /maximum upload size|payload too large|request entity too large/i.test(errorMessage);
      const networkError = !errorStatus && /network request failed|network error/i.test(errorMessage);
      console.error('Profile image upload failed:', errorStatus, error.response?.data || errorMessage);
      Alert.alert(
        sizeLimitExceeded ? 'Image too large' : networkError ? 'Connection failed' : 'Upload failed',
        sizeLimitExceeded
          ? 'Choose a photo that is 1 MB or smaller.'
          : networkError
            ? 'Could not reach the server. Check that the phone and server are on the same Wi-Fi, then retry.'
            : errorMessage
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    const showAtFallbackPosition = () => {
      setImageOptionsPosition({ top: Math.min(160, Math.max(12, windowHeight - 190)), left: 12 });
      setShowImageOptionsModal(true);
    };

    if (!profileImageWrapperRef.current?.measureInWindow) {
      showAtFallbackPosition();
      return;
    }

    profileImageWrapperRef.current.measureInWindow((x, y, width, height) => {
      const popoverWidth = Math.min(190, windowWidth - 24);
      setImageOptionsPosition({
        top: Math.min(y + height + 8, Math.max(12, windowHeight - 190)),
        left: Math.max(12, Math.min(x, windowWidth - popoverWidth - 12)),
      });
      setShowImageOptionsModal(true);
    });
  };

  const selectImageOption = (action) => {
    setShowImageOptionsModal(false);
    setTimeout(action, 250);
  };

  const handleUpdateProfile = async () => {
    setSavingProfile(true);
    try {
      let empId = user?.id;
      if (!empId) {
        const empData = await AsyncStorage.getItem('employeeData');
        if (empData) {
          empId = JSON.parse(empData).id;
        }
      }
      
      const updateData = {
        empId: empId,
        name: editData.name,
        email: editData.email,
        phone: editData.phone,
        address1: editData.address1,
        address2: editData.address2,
        talukName: editData.talukName,
        gender: editData.gender,
      };
      
      const response = await axios.post(`${API_BASE}/profile/update`, updateData);
      
      if (response.data.status === 'success') {
        Alert.alert('Success', 'Profile updated successfully!');
        onProfileUpdated?.({
          name: updateData.name,
          email: updateData.email,
          phone: updateData.phone,
        });
        setIsEditingProfile(false);
        loadEmployeeProfile();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update profile.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelProfileEdit = () => {
    setEditData({
      name: employeeData?.name || user?.name || '',
      gender: employeeData?.gender || '',
      email: employeeData?.email || user?.email || '',
      phone: employeeData?.phone || user?.phone || '',
      address1: employeeData?.address1 || '',
      address2: employeeData?.address2 || '',
      talukName: employeeData?.talukName || '',
    });
    setIsEditingProfile(false);
  };

  const getGenderIcon = (gender) => {
    if (gender === 'M') return 'male-outline';
    if (gender === 'F') return 'female-outline';
    return 'person-outline';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2b78c5" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar backgroundColor="#1976d2" barStyle="light-content" />
      
      <View style={styles.profileHeader}>
        <TouchableOpacity
          ref={profileImageWrapperRef}
          onPress={showImageOptions}
          style={styles.profileImageWrapper}
        >
          {uploadingImage ? (
            <View style={styles.profileImageSmall}>
              <ActivityIndicator size="small" color="#2b78c5" />
            </View>
          ) : profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImageSmall} />
          ) : (
            <View style={styles.profileImageSmall}>
              <Ionicons name="person" size={30} color="#2b78c5" />
            </View>
          )}
          <View style={styles.cameraIconSmall}>
            <Ionicons name="camera" size={10} color="#fff" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileNameHeader}>{employeeData?.name || user?.name || 'Employee Name'}</Text>
          <Text style={styles.profileRoleHeader}>{employeeData?.role || user?.role || 'User'}</Text>
          <Text style={styles.profileIdHeader}>ID: {employeeData?.id || user?.id || 'N/A'}</Text>
        </View>
        
      </View>

      {/* Profile Details Card */}
      <View style={styles.detailsCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardTitleNoMargin]}>
            {compact ? 'Contact Details' : 'Profile Details'}
          </Text>
          {!compact && !isEditingProfile && (
            <TouchableOpacity
              style={styles.inlineEditButton}
              onPress={() => setIsEditingProfile(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile details"
            >
              <Ionicons name="create-outline" size={16} color="#2b78c5" />
              <Text style={styles.inlineEditButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!compact && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="person-outline" size={18} color="#2b78c5" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Full Name</Text>
              {isEditingProfile ? (
                <TextInput
                  style={styles.inlineEditInput}
                  value={editData.name}
                  onChangeText={(text) => setEditData(current => ({ ...current, name: text }))}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94a3b8"
                />
              ) : (
                <Text style={styles.detailValue}>{employeeData?.name || 'Not set'}</Text>
              )}
            </View>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="mail-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Email Address</Text>
            {isEditingProfile ? (
              <TextInput
                style={styles.inlineEditInput}
                value={editData.email}
                onChangeText={(text) => setEditData(current => ({ ...current, email: text }))}
                placeholder="Enter email address"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.detailValue}>{employeeData?.email || 'Not set'}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="call-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Phone Number</Text>
            {isEditingProfile ? (
              <TextInput
                style={styles.inlineEditInput}
                value={editData.phone}
                onChangeText={(text) => setEditData(current => ({ ...current, phone: text }))}
                placeholder="Enter phone number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.detailValue}>{employeeData?.phone || 'Not set'}</Text>
            )}
          </View>
        </View>
        
        {!compact && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar-outline" size={18} color="#2b78c5" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date of Joining</Text>
              <Text style={styles.detailValue}>{employeeData?.joiningDate || 'Not set'}</Text>
            </View>
          </View>
        )}
        
        {!compact && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              {getGenderIcon(employeeData?.gender) === 'male-outline' ? (
                <Ionicons name="male-outline" size={18} color="#2b78c5" />
              ) : getGenderIcon(employeeData?.gender) === 'female-outline' ? (
                <Ionicons name="female-outline" size={18} color="#2b78c5" />
              ) : (
                <Ionicons name="person-outline" size={18} color="#2b78c5" />
              )}
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Gender</Text>
              {isEditingProfile ? (
                <View style={styles.inlineGenderContainer}>
                  {[
                    { value: 'M', label: 'Male', icon: 'male-outline' },
                    { value: 'F', label: 'Female', icon: 'female-outline' },
                  ].map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.inlineGenderOption,
                        editData.gender === option.value && styles.inlineGenderOptionSelected,
                      ]}
                      onPress={() => setEditData(current => ({ ...current, gender: option.value }))}
                    >
                      <Ionicons
                        name={option.icon}
                        size={16}
                        color={editData.gender === option.value ? '#2b78c5' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.inlineGenderText,
                          editData.gender === option.value && styles.inlineGenderTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.detailValue}>
                  {employeeData?.gender === 'M' ? 'Male' : employeeData?.gender === 'F' ? 'Female' : 'Not set'}
                </Text>
              )}
            </View>
          </View>
        )}

        {compact && (
          <>
            {employeeData?.districtName && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location-outline" size={18} color="#2b78c5" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>District</Text>
                  <Text style={styles.detailValue}>{employeeData.districtName}</Text>
                </View>
              </View>
            )}
            {employeeData?.stateName && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="flag-outline" size={18} color="#2b78c5" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>State</Text>
                  <Text style={styles.detailValue}>{employeeData.stateName}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* Address Card */}
      {!compact && <View style={styles.detailsCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardTitleNoMargin]}>Address Information</Text>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="location-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Street Address</Text>
            {isEditingProfile ? (
              <TextInput
                style={styles.inlineEditInput}
                value={editData.address1}
                onChangeText={(text) => setEditData(current => ({ ...current, address1: text }))}
                placeholder="Enter street address"
                placeholderTextColor="#94a3b8"
              />
            ) : (
              <Text style={styles.detailValue}>{employeeData?.address1 || 'Not set'}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="location-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Area</Text>
            {isEditingProfile ? (
              <TextInput
                style={styles.inlineEditInput}
                value={editData.address2}
                onChangeText={(text) => setEditData(current => ({ ...current, address2: text }))}
                placeholder="Enter area"
                placeholderTextColor="#94a3b8"
              />
            ) : (
              <Text style={styles.detailValue}>{employeeData?.address2 || 'Not set'}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="business-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Taluk / City</Text>
            {isEditingProfile ? (
              <TextInput
                style={styles.inlineEditInput}
                value={editData.talukName}
                onChangeText={(text) => setEditData(current => ({ ...current, talukName: text }))}
                placeholder="Enter taluk or city"
                placeholderTextColor="#94a3b8"
              />
            ) : (
              <Text style={styles.detailValue}>{employeeData?.talukName || 'Not set'}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="flag-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>State</Text>
            <Text style={styles.detailValue}>{employeeData?.stateName || 'Not set'}</Text>
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="map-outline" size={18} color="#2b78c5" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>District</Text>
            <Text style={styles.detailValue}>{employeeData?.districtName || 'Not set'}</Text>
          </View>
        </View>

        {isEditingProfile && (
          <View style={styles.inlineEditActions}>
            <TouchableOpacity style={styles.inlineCancelButton} onPress={cancelProfileEdit}>
              <Text style={styles.inlineCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inlineSaveButton, savingProfile && styles.inlineSaveButtonDisabled]}
              onPress={handleUpdateProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.inlineSaveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>}

      <View style={styles.footerSpace} />

      <Modal
        visible={showImageOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageOptionsModal(false)}
      >
        <View style={styles.imageOptionsOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowImageOptionsModal(false)}
            activeOpacity={1}
          />
          <View
            style={[
              styles.imageOptionsContainer,
              {
                top: imageOptionsPosition.top,
                left: imageOptionsPosition.left,
                width: Math.min(190, windowWidth - 24),
              },
            ]}
          >
            <View style={styles.imageOptionsHeader}>
              <TouchableOpacity
                onPress={() => setShowImageOptionsModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close photo options"
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.imageOptionRow}
              onPress={() => selectImageOption(takePhoto)}
              accessibilityRole="button"
            >
              <View style={[styles.imageOptionIcon, styles.cameraOptionIcon]}>
                <Ionicons name="camera-outline" size={21} color="#1976d2" />
              </View>
              <View style={styles.imageOptionTextContainer}>
                <Text style={styles.imageOptionTitle}>Take Photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageOptionRow}
              onPress={() => selectImageOption(pickImage)}
              accessibilityRole="button"
            >
              <View style={[styles.imageOptionIcon, styles.galleryOptionIcon]}>
                <Ionicons name="images-outline" size={21} color="#16856b" />
              </View>
              <View style={styles.imageOptionTextContainer}>
                <Text style={styles.imageOptionTitle}>Choose from Gallery</Text>
              </View>
            </TouchableOpacity>

            {profileImage && (
              <TouchableOpacity
                style={[styles.imageOptionRow, styles.deleteImageOptionRow]}
                onPress={() => selectImageOption(deleteProfileImage)}
                accessibilityRole="button"
              >
                <View style={[styles.imageOptionIcon, styles.deleteOptionIcon]}>
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                </View>
                <View style={styles.imageOptionTextContainer}>
                  <Text style={styles.deleteImageOptionTitle}>Delete Photo</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  profileHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    gap: 10,
  },
  profileImageWrapper: {
    position: 'relative',
  },
  profileImageSmall: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#E8F1FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2b78c5',
  },
  cameraIconSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2b78c5',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileNameHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: 2,
  },
  profileRoleHeader: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  profileIdHeader: {
    fontSize: 11,
    color: '#999',
  },
  detailsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2b78c5',
    paddingLeft: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitleNoMargin: {
    flex: 1,
    marginBottom: 0,
  },
  inlineEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eaf3ff',
  },
  inlineEditButtonText: {
    color: '#2b78c5',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineEditInput: {
    minHeight: 36,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d8e2ee',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    fontSize: 14,
    color: '#1e293b',
  },
  inlineGenderContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  inlineGenderOption: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d8e2ee',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  inlineGenderOptionSelected: {
    borderColor: '#2b78c5',
    backgroundColor: '#eaf3ff',
  },
  inlineGenderText: {
    color: '#64748b',
    fontSize: 12,
  },
  inlineGenderTextSelected: {
    color: '#2b78c5',
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailIcon: {
    width: 32,
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
    marginLeft: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#999',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  inlineEditActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#edf0f4',
  },
  inlineCancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  inlineCancelButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  inlineSaveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2b78c5',
  },
  inlineSaveButtonDisabled: {
    opacity: 0.6,
  },
  inlineSaveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  footerSpace: {
    height: 30,
  },
  imageOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  imageOptionsContainer: {
    position: 'absolute',
    maxWidth: 190,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  imageOptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 26,
  },
  imageOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f4',
    gap: 8,
  },
  imageOptionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOptionIcon: {
    backgroundColor: '#eaf3ff',
  },
  galleryOptionIcon: {
    backgroundColor: '#e8f7f2',
  },
  deleteOptionIcon: {
    backgroundColor: '#fef2f2',
  },
  imageOptionTextContainer: {
    flex: 1,
  },
  imageOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  deleteImageOptionRow: {
    borderBottomWidth: 0,
  },
  deleteImageOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
});