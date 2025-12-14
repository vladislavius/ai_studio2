import React, { useMemo } from 'react';
import { ORGANIZATION_STRUCTURE } from '../constants';
import { Employee as EmployeeType } from '../types';
import { differenceInDays, format, isToday, addYears, isSameDay } from 'date-fns';
import { Gift, Calendar, User, Bell } from 'lucide-react';

interface BirthdaysProps {
  employees: EmployeeType[];
}

const Birthdays: React.FC<BirthdaysProps> = ({ employees }) => {
  const processedBirthdays = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();

    return employees
      .filter(emp => emp.birth_date)
      .map(emp => {
        const birthDate = new Date(emp.birth_date!);
        // Manual setYear to avoid import issues
        let nextBirthday = new Date(birthDate);
        nextBirthday.setFullYear(currentYear);
        
        if (nextBirthday < today && !isToday(nextBirthday)) {
          nextBirthday = addYears(nextBirthday, 1);
        }

        const daysUntil = differenceInDays(nextBirthday, today);
        
        return {
          ...emp,
          nextBirthday,
          daysUntil,
          age: currentYear - birthDate.getFullYear(),
          isToday: isToday(nextBirthday)
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  const upcoming = processedBirthdays.filter(b => b.daysUntil <= 14);
  const allByMonth = useMemo(() => {
    const groups: { [key: number]: typeof processedBirthdays } = {};
    processedBirthdays.forEach(emp => {
      const month = emp.nextBirthday.getMonth();
      if (!groups[month]) groups[month] = [];
      groups[month].push(emp);
    });
    return groups;
  }, [processedBirthdays]);

  const getDeptName = (ids?: string[]) => {
    if (!ids || ids.length === 0) return 'No Dept';
    return ORGANIZATION_STRUCTURE[ids[0]]?.name || 'Unknown';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-pink-100 font-medium">Today's Birthdays</p>
              <h3 className="text-4xl font-bold mt-2">{processedBirthdays.filter(b => b.isToday).length}</h3>
            </div>
            <Gift size={32} className="text-pink-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 font-medium">Upcoming (14 days)</p>
              <h3 className="text-4xl font-bold mt-2">{upcoming.length}</h3>
            </div>
            <Calendar size={32} className="text-amber-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 font-medium">Total Birthdays</p>
              <h3 className="text-4xl font-bold mt-2">{processedBirthdays.length}</h3>
            </div>
            <User size={32} className="text-blue-200" />
          </div>
        </div>
      </div>

      {/* Upcoming Section */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="text-amber-500" /> Upcoming Celebrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map(emp => (
              <div key={emp.id} className={`bg-white p-4 rounded-xl border-l-4 shadow-sm flex items-center gap-4 ${emp.isToday ? 'border-pink-500 bg-pink-50' : 'border-amber-400'}`}>
                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><User /></div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{emp.full_name}</h4>
                  <p className="text-xs text-gray-500">{emp.position} • {getDeptName(emp.department)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${emp.isToday ? 'bg-pink-200 text-pink-700' : 'bg-amber-100 text-amber-700'}`}>
                      {emp.isToday ? 'TODAY!' : `In ${emp.daysUntil} days`}
                    </span>
                    <span className="text-xs text-gray-400">{format(emp.nextBirthday, 'MMM d')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Birthdays Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">All Birthdays by Month</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 12 }).map((_, monthIndex) => {
              const monthEmps = allByMonth[monthIndex] || [];
              if (monthEmps.length === 0) return null;
              
              const monthName = format(new Date(2000, monthIndex, 1), 'MMMM');
              
              return (
                <div key={monthIndex} className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{monthName}</h3>
                  <div className="space-y-3">
                    {monthEmps.map(emp => (
                      <div key={emp.id} className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs"><User size={14} /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{emp.full_name}</p>
                          <p className="text-xs text-gray-500">{format(new Date(emp.birth_date!), 'MMM d')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Birthdays;