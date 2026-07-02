import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ProjectData } from '../../types';
import { isAtRisk, projectVariance } from '../../utils/dashboardMetrics';
import { COLORS } from '../../constants';
import { Card } from '../ui';

// Buckets projects by health using variance.
export const StatusDonut: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const ahead = projects.filter((p) => projectVariance(p) >= 0).length;
  const risk = projects.filter(isAtRisk).length;
  const behind = projects.length - ahead - risk;
  const data = [
    { name: 'Sesuai/di atas rencana', value: ahead, color: COLORS.statusPositive },
    { name: 'Sedikit tertinggal', value: behind, color: COLORS.statusWarning },
    { name: 'Berisiko', value: risk, color: COLORS.statusDanger },
  ].filter((d) => d.value > 0);

  return (
    <Card title="Distribusi Status">
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada proyek.</p>
      ) : (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
