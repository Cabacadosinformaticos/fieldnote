import { StyleSheet, View } from 'react-native';

type ScaleFaceProps = {
  level: number;
  color: string;
};

export function ScaleFace({ level, color }: ScaleFaceProps) {
  const mouthStyle =
    level <= 1 ? styles.mouthFrown : level === 2 ? styles.mouthFlat : styles.mouthSmile;
  const curveStyle =
    level === 2 ? null : level >= 3 || level <= 1 ? styles.mouthStrong : styles.mouthSoft;

  return (
    <View style={[styles.face, { borderColor: color }]}>
      <View style={[styles.eye, styles.eyeLeft, { backgroundColor: color }]} />
      <View style={[styles.eye, styles.eyeRight, { backgroundColor: color }]} />
      <View
        style={[
          styles.mouth,
          mouthStyle,
          curveStyle,
          { borderColor: color },
          level === 2 && { backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.7,
  },
  eye: {
    position: 'absolute',
    top: 14,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  eyeLeft: {
    left: 13,
  },
  eyeRight: {
    right: 13,
  },
  mouth: {
    position: 'absolute',
    left: 12.5,
    bottom: 9,
    width: 19,
  },
  mouthSmile: {
    borderBottomWidth: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  mouthFrown: {
    borderTopWidth: 2,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  mouthFlat: {
    height: 2,
    borderRadius: 1,
  },
  mouthStrong: {
    height: 10,
  },
  mouthSoft: {
    height: 6,
  },
});
