import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'

const cashin = () => {
    const router = useRouter()
  return (
    <View>
      <Text>cashin</Text>
      <View>
        <Text>Amount:</Text>
        <TextInput
          placeholder="Enter amount"
          style={{
            borderWidth: 1,
            borderColor: 'gray',
            padding: 10,
            marginVertical: 10,
          }}
        />
        <TouchableOpacity>
            <Text>Cash In</Text>
        </TouchableOpacity>
      </View>
      <View>
        <TouchableOpacity onPress={() => router.push('/palace/account/transactions')}>
            <Text>View Transaction History</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default cashin