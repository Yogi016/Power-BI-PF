import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ProjectData } from '../../types';
import { projectHealth } from '../../utils/dashboardMetrics';
import type { ProjectHealth } from '../../utils/dashboardMetrics';
import { COLORS } from '../../constants';
import { Card } from '../ui';

// Buckets projects by 4-state health.
export const StatusDonut: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const count = (h: ProjectHealth) => projects.filter((p) => projectHealth(p) === h).length;
  const data = [
    { name: 'Sesuai/di atas rencana', value: count('on-track'), color: COLORS.statusPositive },
    { name: 'Sedikit tertinggal', value: count('behind'), color: COLORS.statusWarning },
    { name: 'Berisiko', value: count('at-risk'), color: COLORS.statusDanger },
    { name: 'Belum ada realisasi', value: count('not-started'), color: COLORS.statusNeutral },
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
