import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'
import { useGlobalContext } from '../globalcontext/globalcontext'

const index = () => {
    const router = useRouter()
    const { account, setAccount } = useGlobalContext()
  return (
    <View>
      <Text>Account</Text>
      <View>
        <Text>{account?.name}</Text>
        <Text>Balance: {account?.balance}</Text>
      </View>
      <View>
        <TouchableOpacity onPress={()=>{router.push('/palace/account/cashin')}}>
            <Text>Cash In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{router.push('/palace/account/cashout')}}>
            <Text>Cash Out</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{router.push('/palace/account/transactions')}}>
          <Text>
            View Transaction History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default index