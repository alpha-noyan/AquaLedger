import { View, Text, Touchable, TouchableOpacity } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'

const index = () => {
    const router = useRouter()
  return (
    <View>
      <Text>Landing</Text>
      <TouchableOpacity onPress={()=>{router.push('/palace')}}>
        <Text>Start</Text>
      </TouchableOpacity>
    </View>
  )
}

export default index