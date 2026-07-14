import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useGlobalContext } from '../globalcontext/globalcontext';

const CashOut = () => {
  const router = useRouter();
  const { account, setAccount } = useGlobalContext();

  const [amount, setAmount] = useState('');

  const withdrawBalance = () => {
    const cashOutAmount = Number(amount);

    if (isNaN(cashOutAmount) || cashOutAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (cashOutAmount > account.balance) {
      alert('Insufficient balance');
      return;
    }

    setAccount({
      ...account,
      balance: account.balance - cashOutAmount,
    });

    setAmount('');
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Cash Out</Text>

      <View>
        <Text>Current Balance: {account.balance}</Text>

        <TextInput
          placeholder="Enter amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          style={{
            borderWidth: 1,
            borderColor: 'gray',
            padding: 10,
            marginVertical: 10,
            borderRadius: 5,
          }}
        />

        <TouchableOpacity
          onPress={withdrawBalance}
          style={{
            backgroundColor: '#F44336',
            padding: 12,
            borderRadius: 5,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Cash Out
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          onPress={() =>
            router.push('/palace/account/transactions')
          }
        >
          <Text style={{ color: 'blue' }}>
            View Transaction History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CashOut;