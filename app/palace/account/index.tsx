import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'

const index = () => {
    const router = useRouter()
  return (
    <View>
      <Text>Account</Text>
      <View>
        <Text>Khattak Traders</Text>
        <Text>Balance: 1000</Text>
      </View>
      <View>
        <TouchableOpacity onPress={()=>{router.push('/palace/account/cashin')}}>
            <Text>Cash In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{router.push('/palace/account/cashout')}}>
            <Text>Cash Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default index