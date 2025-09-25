// Update the container styling in copy-trading.tsx
import React, { useState } from 'react';
import { Tabs, Tab, Box, styled } from '@mui/material';
import CopyTrading1 from './copy-trading1';
import CopyTrading2 from './copy-trading2';

// Add this styled component for the container
const FullWidthContainer = styled('div')({
  width: '100%',
  maxWidth: '100%',
  margin: 0,
  padding: 0,
  overflowX: 'hidden' // Prevent horizontal scroll if needed
});

const StyledTabs = styled(Tabs)({
  '& .MuiTabs-indicator': {
    backgroundColor: '#00ff9d',
    height: 3
  },
  width: '100%'
});

const StyledTab = styled(Tab)({
  color: '#aaa',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  '&.Mui-selected': {
    color: '#00ff9d'
  }
});

const CopyTrading = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <FullWidthContainer> {/* Changed from regular div */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        mb: 3,
        width: '100%'
      }}>
        <StyledTabs value={activeTab} onChange={handleChange}>
          <StyledTab label="Normal Copy Trading" />
          <StyledTab label="Demo to Real" />
        </StyledTabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Box sx={{ width: '100%' }}>
          <CopyTrading1 />
        </Box>
      </TabPanel>
      
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ width: '100%' }}>
          <CopyTrading2 />
        </Box>
      </TabPanel>
    </FullWidthContainer>
  );
};

// Tab panel component with full width
function TabPanel(props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`copy-trading-tabpanel-${index}`}
      aria-labelledby={`copy-trading-tab-${index}`}
      style={{ width: '100%' }} // Added full width style
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0, width: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default CopyTrading;