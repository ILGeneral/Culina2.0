import React, { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import Background from "@/components/Background";
import { onboardingStyles as styles } from "@/styles/auth/onboardingStyles";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    title: "Your Kitchen, Smarter Than Ever!",
    description:
      "Let Culina's AI craft delicious meals tailored to your taste, preferences, and dietary goals!",
    image: require("@/assets/images/Logo.png"),
  },
  {
    id: "2",
    title: "Use What You Already Have!",
    description:
      "Scan or add your ingredients! Culina helps reduce waste by using what's already in your kitchen!",
    image: require("@/assets/images/onboarding2.png"),
  },
  {
    id: "3",
    title: "Track Your Nutrition!",
    description:
      "Stay on top of your daily calorie goals while enjoying creative and balanced meals!",
    image: require("@/assets/images/onboarding3.png"),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef<FlatList>(null);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0 && viewableItems[0]?.index !== undefined) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Mark onboarding as completed before navigating
      const user = auth.currentUser;
      if (user) {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            hasCompletedOnboarding: true,
          });
        } catch (error) {
          console.error("Error updating onboarding status:", error);
        }
      }
      router.replace("/(tabs)/home");
    }
  };

  const Dot = ({ index }: { index: number }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];
    const dotWidth = scrollX.interpolate({
      inputRange,
      outputRange: [8, 16, 8],
      extrapolate: "clamp",
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: "clamp",
    });
    return (
      <Animated.View
        style={{
          height: 8,
          width: dotWidth,
          borderRadius: 4,
          backgroundColor: "#128AFA",
          marginHorizontal: 4,
          opacity,
        }}
      />
    );
  };

  const renderItem = ({ item }: any) => (
    <View style={[styles.slide, { width }]}>
      <Image source={item.image} style={styles.image} resizeMode="contain" />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <Background>
      <View style={styles.container}>
      <FlatList
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <Dot key={index.toString()} index={index} />
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity onPress={handleNext} style={styles.button}>
        <Text style={styles.buttonText}>
          {currentIndex === slides.length - 1 ? "Proceed" : "Next"}
        </Text>
      </TouchableOpacity>
      </View>
    </Background>
  );
}
