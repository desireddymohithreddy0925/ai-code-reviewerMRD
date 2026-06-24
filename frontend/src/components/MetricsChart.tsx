import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// Dummy Data to be replaced with actual API response
const dummyData = data || [];

  return (
    <div 
      className="chart-container" 
      style={{ 
        height: 350, 
      }}
    >
      <h3 style={{ color: colors.title, marginTop: 0, marginBottom: '20px', fontSize: '14px', fontWeight: 700 }}>
        Codebase Metrics Overview
      </h3>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={dummyData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis 
            dataKey="month" 
            stroke={colors.axis} 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            stroke={colors.axis} 
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: colors.tooltipBg, 
              border: `1px solid ${colors.tooltipBorder}`, 
              borderRadius: '8px', 
              color: colors.tooltipText,
              boxShadow: theme === 'dark' 
                ? '0 4px 16px rgba(0,0,0,0.4)' 
                : '0 4px 16px rgba(0,0,0,0.1)',
            }} 
            itemStyle={{ color: colors.tooltipItem }}
            labelStyle={{ color: colors.tooltipText, fontWeight: 600 }}
          />
          <Line type="monotone" dataKey="bugs" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6, strokeWidth: 2 }} />
          <Line type="monotone" dataKey="security" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};