import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii } from '@/theme';

type GardenSceneProps = {
  height: number;
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function GardenScene({ height, label, style }: GardenSceneProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      style={[styles.scene, { height }, style]}
    >
      <View style={styles.sky} />
      <View style={styles.ground} />
      <View style={styles.path} />
      <View style={[styles.trunk, styles.trunkLeft]} />
      <View style={[styles.tree, styles.treeLeft]} />
      <View style={[styles.trunk, styles.trunkRight]} />
      <View style={[styles.tree, styles.treeRight]} />
      <View style={styles.benchBack} />
      <View style={styles.benchSeat} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    overflow: 'hidden',
    borderRadius: radii.card,
    backgroundColor: '#CFE3D8',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#CFE3D8',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '35%',
    backgroundColor: '#4E8B63',
  },
  path: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '12%',
    backgroundColor: '#3F7552',
  },
  tree: {
    position: 'absolute',
    aspectRatio: 1,
    borderRadius: 999,
  },
  treeLeft: {
    left: '7%',
    bottom: '27%',
    width: '29%',
    backgroundColor: '#2E6B4F',
  },
  treeRight: {
    left: '52%',
    bottom: '30%',
    width: '36%',
    backgroundColor: '#24563F',
  },
  trunk: {
    position: 'absolute',
    backgroundColor: '#6B5A3A',
  },
  trunkLeft: {
    left: '20%',
    bottom: '15%',
    width: '3.5%',
    height: '17%',
  },
  trunkRight: {
    left: '68.5%',
    bottom: '15%',
    width: '4%',
    height: '19%',
    backgroundColor: '#5A4A2E',
  },
  benchSeat: {
    position: 'absolute',
    left: '34%',
    bottom: '8.5%',
    width: '23%',
    height: '4.3%',
    borderRadius: 6,
    backgroundColor: '#C9A46A',
  },
  benchBack: {
    position: 'absolute',
    left: '36.5%',
    bottom: '13%',
    width: '18.5%',
    height: '9%',
    borderRadius: 6,
    backgroundColor: '#B8873E',
  },
});
