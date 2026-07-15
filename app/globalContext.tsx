import {createContext, useContext, useState} from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [plantName, setPlantName] = useState('Aqua Water Plant');
  const [balance, setBalance] = useState(0);
  const [sales, setSales] = useState([]);
  return (
    <GlobalContext.Provider value={{ balance, setBalance, plantName, setPlantName, sales, setSales }}>
      {children}
    </GlobalContext.Provider>
  );
}

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within a GlobalProvider');
  }
  return context;
};