import { View, Text, Touchable, TouchableOpacity } from 'react-native'
import React from 'react'

const index = () => {
  return (
    <View>
      <Text>Landing</Text>
      <TouchableOpacity onPress={()=>{}}>
        <Text>Start</Text>
      </TouchableOpacity>
    </View>
  )
}

export default index