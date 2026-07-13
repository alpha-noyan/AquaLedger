import {createContext, useContext, useState} from "react";

const GlobalContext = createContext({});

export const GlobalContextProvider = ({children}) => {
    const [account, setAccount] = useState({
        name: 'Khattak Traders',
        balance: 1000
    })
    
    return (
        <GlobalContext.Provider value={{ account, setAccount }}>
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobalContext = () => useContext(GlobalContext);