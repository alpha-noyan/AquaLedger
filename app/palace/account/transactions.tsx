import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'

const transactions = () => {
    const transactions = [
        {
            name: "Khan",
            type: "Cash In",
            amount: 1000,
            dateTime: "2024-06-01 10:00 AM",
            reversed: false
        },
        {
            name: "Khan",
            type: "Cash Out",
            amount: 500,
            dateTime: "2024-06-02 2:00 PM",
            reversed: false
        },
        {
            name: "Khan",
            type: "Cash In",
            amount: 2000,
            dateTime: "2024-06-03 11:30 AM",
            reversed: true
        }
    ]
  return (
    <View>
      <Text>transactions</Text>
      <View>
        {transactions.map((transaction, index) => (
            <View key={index} style={{ marginVertical: 10, padding: 10, borderWidth: 1, borderColor: 'gray' }}>
                <Text>Name: {transaction.name}</Text>
                <Text>Type: {transaction.type}</Text>
                <Text>Amount: {transaction.amount}</Text>
                <Text>Date & Time: {transaction.dateTime}</Text>
                {
                    transaction.reversed ? <Text style={{ color: 'red' }}>Reversed</Text> : <TouchableOpacity><Text>Reverse</Text></TouchableOpacity>
                }
            </View>
        ))}
      </View>
    </View>
  )
}

export default transactions