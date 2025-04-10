import React from 'react'
import { Text, StyleProp, TextStyle } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'

interface GradientTextProps {
  style?: StyleProp<TextStyle> // Optional style for the Text component
  children: React.ReactNode // Content to be displayed
}

const GradientText: React.FC<GradientTextProps> = ({ style, children }) => {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient
        colors={['#FF9F45', '#D494FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  )
}

export default GradientText
