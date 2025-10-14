import React, { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  TouchableOpacity,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X } from "lucide-react-native";

// Custom Hooks & Libs
import { useInventory } from "@/hooks/useInventory";
import { auth } from "@/lib/firebaseConfig";
import { uploadImageAsync } from "@/lib/uploadImage";
import { detectFoodFromImage } from "@/lib/clarifai";


import InventoryHeader from "@/app/components/inventory/InventoryHeader";
import InventoryListItem from "@/app/components/inventory/InventoryListItem";
import AddEditModal from "@/app/components/inventory/AddEditModal";
import EmptyPantry from "@/app/components/inventory/EmptyPantry";
