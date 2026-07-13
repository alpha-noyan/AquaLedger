import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'

const index = () => {
    const router = useRouter()
    const btns = [
        {
            name: 'Account',
            route: '/palace/account'
        },
        {
            name: 'Stock',
            route: '/palace/stock'
        },
        {
            name: 'Orders',
            route: '/palace/orders'
        },
        {
            name: 'Sellings',
            route: '/palace/sellings'
        },
        {
            name: 'Loans',
            route: '/palace/loans'
        },
        {
            name: 'Wasooli',
            route: '/palace/wasooli'
        },
        {
            name: 'Withdrawals',
            route: '/palace/withdrawals'
        },
        {
            name: 'Other Expenses',
            route: '/palace/other-expenses'
        },
        {
            name: 'Vehicles',
            route: '/palace/vehicles'
        }
        ,{
            name: 'Employees',
            route: '/palace/employees'
        }
    ]
  return (
    <View>
      <Text>Welcome back to AquaLedger</Text>
      <View>
        <Text>Khattak Traders</Text>
      </View>
      <View>
        {
            btns.map((btn, index) => {
                return (
                    <TouchableOpacity key={index} onPress={()=>{router.push(btn.route)}}>
                        <Text>{btn.name}</Text>
                    </TouchableOpacity>
                )
            })
        }
      </View>
    </View>
  )
}

export default index