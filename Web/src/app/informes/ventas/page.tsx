'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { useResponsive } from '../../../hooks/useResponsive';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { getVentas } from '../../../services/ventaService';
import { getTiendas } from '../../../services/tiendaService';
import { getUsuarios } from '../../../services/usuarioService';
import { getServicios } from '../../../services/servicioService';
import { Calendar, Search, ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';

const InformeVentasPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const PieChart = ({ data, size = 200 }: { data: any[], size?: number }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
      return (
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 10}
            fill={isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
            stroke={isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}
            strokeWidth={2}
          />
        </svg>
      );
    }

    let startAngle = 0;
    const radius = size / 2;
    const center = size / 2;

    return (
      <svg width={size} height={size}>
        {data.map((item, index) => {
          const angle = (item.value / total) * 360;
          const endAngle = startAngle + angle;

          const x1 = center + radius * Math.cos((startAngle - 90) * Math.PI / 180);
          const y1 = center + radius * Math.sin((startAngle - 90) * Math.PI / 180);
          const x2 = center + radius * Math.cos((endAngle - 90) * Math.PI / 180);
          const y2 = center + radius * Math.sin((endAngle - 90) * Math.PI / 180);

          const largeArcFlag = angle > 180 ? 1 : 0;

          const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

          startAngle = endAngle;

          return (
            <path
              key={index}
              d={pathData}
              fill={item.color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          );
        })}
      </svg>
    );
  };

  const LineChart = ({ data, width = 800, height = 300, selectedPoint, setSelectedPoint }: { data: any[], width?: number, height?: number, selectedPoint?: any, setSelectedPoint?: (point: any) => void }) => {
    if (!data || data.length === 0) {
      return (
        <div style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderRadius: '8px'
        }}>
          <span style={{ color: colors.outline, fontSize: '14px' }}>No hay datos para mostrar</span>
        </div>
      );
    }

    const padding = 50;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxCount = Math.max(...data.map((d: any) => d.count || 0));
    const yMax = maxCount > 0 ? maxCount * 1.2 : 10;

    const xStep = chartWidth / (data.length - 1);

    const getY = (value: number) => {
      return padding + chartHeight - (value / yMax) * chartHeight;
    };

    const getX = (index: number) => {
      return padding + index * xStep;
    };

    const points = data.map((d: any, i: number) => `${getX(i)},${getY(d.count)}`).join(' ');

    const handlePointClick = (index: number) => {
      if (setSelectedPoint) {
        setSelectedPoint(data[index]);
      }
    };

    return (
      <div style={{ position: 'relative', width, height }}>
        <svg width={width} height={height}>
          {/* Y axis lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padding + chartHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke={isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                strokeWidth={1}
              />
            );
          })}

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
          />

          {/* Points */}
          {data.map((d: any, i: number) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(d.count)}
              r={selectedPoint === d ? 6 : 4}
              fill={colors.primary}
              stroke={colors.surface}
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={() => handlePointClick(i)}
            />
          ))}

          {/* X axis labels */}
          {data.filter((d: any) => d.count > 0).map((d: any, i: number) => {
            const dataIndex = data.indexOf(d);
            return (
              <text
                key={i}
                x={getX(dataIndex)}
                y={height - padding + 20}
                textAnchor="middle"
                fill={colors.outline}
                fontSize="10"
              >
                {d.hour}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {selectedPoint && setSelectedPoint && (
          <div 
            style={{
              position: 'absolute',
              top: isMobile ? 'auto' : '10px',
              right: isMobile ? 'auto' : '10px',
              left: isMobile ? '50%' : 'auto',
              transform: isMobile ? 'translateX(-50%)' : 'none',
              bottom: isMobile ? '10px' : 'auto',
              backgroundColor: colors.surface,
              padding: '12px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 10,
              minWidth: '200px',
              maxWidth: isMobile ? '90%' : 'auto'
            }}
          >
            <div style={{ 
              color: colors.onSurface, 
              fontSize: '14px', 
              fontWeight: '600',
              marginBottom: '8px',
              borderBottom: `1px solid ${colors.outlineVariant}`,
              paddingBottom: '4px'
            }}>
              {selectedPoint.hour}
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '4px',
              gap: '8px'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%',
                backgroundColor: colors.primary
              }} />
              <span style={{ color: colors.outline, fontSize: '12px' }}>Ventas:</span>
              <span style={{ color: colors.onSurface, fontSize: '12px', fontWeight: '600' }}>
                {selectedPoint.count}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '4px',
              gap: '8px'
            }}>
              <span style={{ color: colors.outline, fontSize: '12px' }}>Total CUP:</span>
              <span style={{ color: colors.onSurface, fontSize: '12px', fontWeight: '600' }}>
                {formatNumber(selectedPoint.totalCUP)}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '4px',
              gap: '8px'
            }}>
              <span style={{ color: colors.outline, fontSize: '12px' }}>Total USD:</span>
              <span style={{ color: colors.onSurface, fontSize: '12px', fontWeight: '600' }}>
                {formatNumber(selectedPoint.totalUSD)}
              </span>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                backgroundColor: colors.outlineVariant,
                border: 'none',
                borderRadius: '4px',
                color: colors.onSurface,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    );
  };

  const MountainChart = ({ data, width = 800, height = 300, selectedPoint, setSelectedPoint }: { data: any[], width?: number, height?: number, selectedPoint?: any, setSelectedPoint?: (point: any) => void }) => {
    if (!data || data.length === 0) {
      return (
        <div style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderRadius: '8px'
        }}>
          <span style={{ color: colors.outline, fontSize: '14px' }}>No hay datos para mostrar</span>
        </div>
      );
    }

    const padding = 50;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(
      ...data.map((d: any) => d.ventasCupEfectivo + d.ventasCupTransferencia + (d.ventasUsdEfectivo + d.ventasUsdTransferencia) * 815),
      ...data.map((d: any) => d.costosCUP + d.costosUSD * 815)
    );
    const yMax = maxValue > 0 ? maxValue * 1.1 : 100;

    const xStep = chartWidth / (data.length - 1 || 1);

    const getY = (value: number) => {
      return padding + chartHeight - (value / yMax) * chartHeight;
    };

    const getX = (index: number) => {
      return padding + index * xStep;
    };

    const metrics = [
      { key: 'ventasCupEfectivo', color: '#4CAF50', label: 'Efectivo CUP' },
      { key: 'ventasCupTransferencia', color: '#2196F3', label: 'Transferencia CUP' },
      { key: 'ventasUsdEfectivo', color: '#FF9800', label: 'Efectivo USD' },
      { key: 'ventasUsdTransferencia', color: '#9C27B0', label: 'Transferencia USD' },
      { key: 'costosCUP', color: '#F44336', label: 'Costos' },
    ];

    const handlePointClick = (index: number) => {
      if (setSelectedPoint) {
        setSelectedPoint(data[index]);
      }
    };

    return (
      <div style={{ position: 'relative', width, height }}>
        <svg width={width} height={height}>
          {/* Y axis lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padding + chartHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke={isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                strokeWidth={1}
              />
            );
          })}

          {/* Lines for each metric */}
          {metrics.map(({ key, color }) => {
            const points = data.map((d: any, i: number) => {
              const value = key === 'costosCUP' ? d.costosCUP : d[key];
              return `${getX(i)},${getY(value)}`;
            }).join(' ');

            return (
              <polyline
                key={key}
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
              />
            );
          })}

          {/* Points */}
          {metrics.map(({ key, color }) => (
            data.map((d: any, i: number) => {
              const value = key === 'costosCUP' ? d.costosCUP : d[key];
              return (
                <circle
                  key={`${key}-${i}`}
                  cx={getX(i)}
                  cy={getY(value)}
                  r={selectedPoint === d ? 6 : 3}
                  fill={color}
                  stroke={colors.surface}
                  strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handlePointClick(i)}
                />
              );
            })
          ))}

          {/* X axis labels */}
          {data.map((d: any, i: number) => (
            <text
              key={i}
              x={getX(i)}
              y={height - padding + 20}
              textAnchor="middle"
              fill={colors.outline}
              fontSize="10"
            >
              {d.date}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {selectedPoint && setSelectedPoint && (
          <div 
            style={{
              position: 'absolute',
              top: isMobile ? 'auto' : '10px',
              right: isMobile ? 'auto' : '10px',
              left: isMobile ? '50%' : 'auto',
              transform: isMobile ? 'translateX(-50%)' : 'none',
              bottom: isMobile ? '10px' : 'auto',
              backgroundColor: colors.surface,
              padding: '12px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 10,
              minWidth: '200px',
              maxWidth: isMobile ? '90%' : 'auto'
            }}
          >
            <div style={{ 
              color: colors.onSurface, 
              fontSize: '14px', 
              fontWeight: '600',
              marginBottom: '8px',
              borderBottom: `1px solid ${colors.outlineVariant}`,
              paddingBottom: '4px'
            }}>
              {selectedPoint.date}
            </div>
            {metrics.map(({ key, color, label }) => (
              <div key={key} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '4px',
                gap: '8px'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%',
                  backgroundColor: color
                }} />
                <span style={{ color: colors.outline, fontSize: '12px' }}>{label}:</span>
                <span style={{ color: colors.onSurface, fontSize: '12px', fontWeight: '600' }}>
                  {formatNumber(key === 'costosCUP' ? selectedPoint.costosCUP : selectedPoint[key])}
                </span>
              </div>
            ))}
            <button
              onClick={() => setSelectedPoint(null)}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                backgroundColor: colors.outlineVariant,
                border: 'none',
                borderRadius: '4px',
                color: colors.onSurface,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    );
  };

  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [selectedDayPoint, setSelectedDayPoint] = useState<any>(null);
  const [selectedHourPoint, setSelectedHourPoint] = useState<any>(null);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [showFormaCobroDropdown, setShowFormaCobroDropdown] = useState(false);

  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    id_usuario: '',
    id_tienda: '',
    id_servicio: '',
    nombre_servicio: '',
    forma_cobro: '',
  });

  const [tiendas, setTiendas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [userSearchText, setUserSearchText] = useState('');
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [hasLoadedAllServicios, setHasLoadedAllServicios] = useState(false);

  const formasCobro = ['Efectivo CUP', 'Efectivo USD', 'Transferencia CUP', 'Transferencia USD'];

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({ activo: true }, undefined, undefined);
      setTiendas(data.data || []);
    } catch (error) {
      console.error('Error fetching tiendas:', error);
    }
  };

  const fetchAllTiendas = async () => {
    if (hasLoadedAllTiendas) return;
    setIsLoadingTiendas(true);
    try {
      // Use valid filter to get all tiendas
      const data = await getTiendas({ activo: true }, undefined, 1000);
      setTiendas(data.data || []);
      setHasLoadedAllTiendas(true);
    } catch (error) {
      console.error('Error fetching all tiendas:', error);
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await getUsuarios({ activo: true }, undefined, undefined);
      setUsers(data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAllUsers = async () => {
    if (hasLoadedAllUsers) return;
    setIsLoadingUsers(true);
    try {
      // Use the non-filter endpoint to get all users
      const data = await getUsuarios({ activo: true }, undefined, 1000);
      setUsers(data.data || []);
      setHasLoadedAllUsers(true);
    } catch (error) {
      console.error('Error fetching all users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchServicios = async (nombreFilter = '') => {
    try {
      const filters = nombreFilter ? { nombre: nombreFilter } : {};
      const data = await getServicios(filters, undefined, undefined);
      setServicios(data.data || []);
    } catch (error) {
      console.error('Error fetching servicios:', error);
    }
  };

  const fetchAllServicios = async () => {
    if (hasLoadedAllServicios) return;
    setIsLoadingServicios(true);
    try {
      // Use valid filter to get all servicios
      const data = await getServicios({}, undefined, 1000);
      setServicios(data.data || []);
      setHasLoadedAllServicios(true);
    } catch (error) {
      console.error('Error fetching all servicios:', error);
    } finally {
      setIsLoadingServicios(false);
    }
  };

  const filteredTiendas = tiendas.filter((t: any) =>
    t.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter((u: any) =>
    u.nombre_natural.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const filteredServicios = servicios.filter((s: any) =>
    s.nombre.toLowerCase().includes(servicioSearchText.toLowerCase())
  );

  useEffect(() => {
    fetchTiendas();
    fetchUsers();
    fetchAllServicios();
    setFilters(prev => ({
      ...prev,
      fecha_desde: formatLocalDate(startDate),
      fecha_hasta: formatLocalDate(endDate),
    }));
  }, []);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const apiFilters = { ...filters };
      
      Object.keys(apiFilters).forEach(key => {
        if (apiFilters[key] === '' || apiFilters[key] === null || apiFilters[key] === undefined) {
          delete apiFilters[key];
        }
      });

      if (apiFilters.fecha_hasta) {
        apiFilters.fecha_hasta = `${apiFilters.fecha_hasta}T23:59:59`;
      }

      const ventasData = await getVentas(apiFilters);
      let allVentas = ventasData.data || [];

      // Apply frontend filtering
      if (filters.id_usuario) {
        allVentas = allVentas.filter(v => 
          v.operaciones && v.operaciones.some((op: any) => op.usuario && op.usuario.id_usuario === parseInt(filters.id_usuario))
        );
      }
      
      if (filters.forma_cobro) {
        allVentas = allVentas.filter(v => 
          v.operaciones && v.operaciones.some((op: any) => op.cuenta && op.cuenta.tipo_cuenta === filters.forma_cobro)
        );
      }
      
      if (filters.nombre_servicio) {
        allVentas = allVentas.filter(v => 
          v.ventas && v.ventas.some((venta: any) => 
            venta.servicioTienda && 
            venta.servicioTienda.servicio && 
            venta.servicioTienda.servicio.nombre === filters.nombre_servicio
          )
        );
      }
      
      if (filters.id_tienda) {
        allVentas = allVentas.filter(v => 
          v.ventas && v.ventas.some((venta: any) => 
            venta.servicioTienda && 
            venta.servicioTienda.id_tienda === parseInt(filters.id_tienda)
          )
        );
      }

      // Group sales by date
      const salesByDate = new Map();

      for (const listaVenta of allVentas) {
        const dateKey = listaVenta.fecha_hora.split('T')[0];
        
        if (!salesByDate.has(dateKey)) {
          salesByDate.set(dateKey, {
            ventasCupEfectivo: 0,
            ventasCupTransferencia: 0,
            ventasUsdEfectivo: 0,
            ventasUsdTransferencia: 0,
            costosCUP: 0,
            costosUSD: 0,
          });
        }

        const dayData = salesByDate.get(dateKey);
        
        if (!filters.forma_cobro) {
          dayData.ventasCupEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0);
          dayData.ventasCupTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
          dayData.ventasUsdEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0);
          dayData.ventasUsdTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);
        } else if (filters.forma_cobro === 'Efectivo CUP') {
          dayData.ventasCupEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0);
        } else if (filters.forma_cobro === 'Efectivo USD') {
          dayData.ventasUsdEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0);
        } else if (filters.forma_cobro === 'Transferencia CUP') {
          dayData.ventasCupTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
        } else if (filters.forma_cobro === 'Transferencia USD') {
          dayData.ventasUsdTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);
        }

        // Calculate costs
        const totalPrecioCobradoCUP = listaVenta.ventas?.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_cup || 0) * parseFloat(v.cantidad || 0)), 0) || 0;
        const totalPrecioCobradoUSD = listaVenta.ventas?.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_usd || 0) * parseFloat(v.cantidad || 0)), 0) || 0;

        const totalIngresoCUP = parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0) + parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
        const totalIngresoUSD = parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0) + parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);

        const isCUPSale = totalIngresoCUP > 0;
        const isUSDSale = totalIngresoUSD > 0;

        for (const venta of listaVenta.ventas || []) {
          const cantidad = parseFloat(venta.cantidad || 0);
          const costoOriginalCUP = parseFloat(venta.costo_original_cup || 0);
          const costoOriginalUSD = parseFloat(venta.costo_original_usd || 0);

          if (isCUPSale && !isUSDSale) {
            dayData.costosCUP += costoOriginalCUP * cantidad;
          } else if (isUSDSale && !isCUPSale) {
            dayData.costosUSD += costoOriginalUSD * cantidad;
          } else if (isCUPSale && isUSDSale) {
            const porcentajeCobroCUP = totalPrecioCobradoCUP > 0 ? totalIngresoCUP / totalPrecioCobradoCUP : 0;
            const porcentajeCobroUSD = totalPrecioCobradoUSD > 0 ? totalIngresoUSD / totalPrecioCobradoUSD : 0;

            dayData.costosCUP += (costoOriginalCUP * cantidad) * porcentajeCobroCUP;
            dayData.costosUSD += (costoOriginalUSD * cantidad) * porcentajeCobroUSD;
          }
        }
      }

      const sortedDates = Array.from(salesByDate.keys()).sort();
      const chartData = sortedDates.map(date => ({
        date,
        ...salesByDate.get(date),
      }));

      const totals = {
        ventasCupEfectivo: chartData.reduce((sum, d) => sum + d.ventasCupEfectivo, 0),
        ventasCupTransferencia: chartData.reduce((sum, d) => sum + d.ventasCupTransferencia, 0),
        ventasUsdEfectivo: chartData.reduce((sum, d) => sum + d.ventasUsdEfectivo, 0),
        ventasUsdTransferencia: chartData.reduce((sum, d) => sum + d.ventasUsdTransferencia, 0),
        costosCUP: chartData.reduce((sum, d) => sum + d.costosCUP, 0),
        costosUSD: chartData.reduce((sum, d) => sum + d.costosUSD, 0),
      };

      // Calculate product sales and profits
      const productosVentas = new Map();

      for (const listaVenta of allVentas) {
        // Get exchange rate from operations (use 815 as default if not available)
        const cambioMoneda = listaVenta.operaciones?.[0]?.cambio_moneda ? parseFloat(listaVenta.operaciones[0].cambio_moneda) : 815;

        const totalIngresoCUP = parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0) + parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
        const totalIngresoUSD = parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0) + parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);

        const isCUPSale = totalIngresoCUP > 0;
        const isUSDSale = totalIngresoUSD > 0;

        for (const venta of listaVenta.ventas || []) {
          const productoNombre = venta.servicioTienda?.servicio?.nombre || 'Producto desconocido';
          const cantidad = parseFloat(venta.cantidad || 0);
          const precioCobradoCUP = parseFloat(venta.precio_cobrado_cup || 0);
          const precioCobradoUSD = parseFloat(venta.precio_cobrado_usd || 0);
          const costoOriginalCUP = parseFloat(venta.costo_original_cup || 0);
          const costoOriginalUSD = parseFloat(venta.costo_original_usd || 0);

          const ventaPrecioCobradoCUP = precioCobradoCUP * cantidad;
          const ventaPrecioCobradoUSD = precioCobradoUSD * cantidad;
          const costoTotalCUP = costoOriginalCUP * cantidad;
          const costoTotalUSD = costoOriginalUSD * cantidad;

          // For sales calculation: use actual received income
          // For single-product sales, all income goes to that product
          // For multi-product sales, distribute proportionally
          let ingresoVentaCUP, ingresoVentaUSD;

          if (listaVenta.ventas.length === 1) {
            // Single product sale - all income goes to this product
            ingresoVentaCUP = totalIngresoCUP;
            ingresoVentaUSD = totalIngresoUSD;
          } else {
            // Multi-product sale - distribute proportionally by price
            const totalPrecioCUP = listaVenta.ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_cup || 0) * parseFloat(v.cantidad || 0)), 0);
            const totalPrecioUSD = listaVenta.ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_usd || 0) * parseFloat(v.cantidad || 0)), 0);

            const proporcionCUP = totalPrecioCUP > 0 ? ventaPrecioCobradoCUP / totalPrecioCUP : 0;
            const proporcionUSD = totalPrecioUSD > 0 ? ventaPrecioCobradoUSD / totalPrecioUSD : 0;

            ingresoVentaCUP = totalIngresoCUP * proporcionCUP;
            ingresoVentaUSD = totalIngresoUSD * proporcionUSD;
          }

          // Distribute costs based on income currency
          let costoAsignadoCUP = 0;
          let costoAsignadoUSD = 0;

          if (isCUPSale && !isUSDSale) {
            // CUP only sale - assign CUP costs
            costoAsignadoCUP = costoTotalCUP;
          } else if (isUSDSale && !isCUPSale) {
            // USD only sale - assign USD costs
            costoAsignadoUSD = costoTotalUSD;
          } else if (isCUPSale && isUSDSale) {
            // Mixed sale - assign each cost to its corresponding currency
            const totalPrecioCUP = listaVenta.ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_cup || 0) * parseFloat(v.cantidad || 0)), 0);
            const totalPrecioUSD = listaVenta.ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_usd || 0) * parseFloat(v.cantidad || 0)), 0);

            const porcentajeCobroCUP = totalPrecioCUP > 0 ? totalIngresoCUP / totalPrecioCUP : 0;
            const porcentajeCobroUSD = totalPrecioUSD > 0 ? totalIngresoUSD / totalPrecioUSD : 0;

            costoAsignadoCUP = costoTotalCUP * porcentajeCobroCUP;
            costoAsignadoUSD = costoTotalUSD * porcentajeCobroUSD;
          } else {
            // No income - assign costs proportionally
            const totalPrecioCUP = listaVenta.ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_cup || 0) * parseFloat(v.cantidad || 0)), 0);
            const totalPrecioUSD = listaVenta.ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.precio_cobrado_usd || 0) * parseFloat(v.cantidad || 0)), 0);

            const proporcionCUP = totalPrecioCUP > 0 ? ventaPrecioCobradoCUP / totalPrecioCUP : 0;
            const proporcionUSD = totalPrecioUSD > 0 ? ventaPrecioCobradoUSD / totalPrecioUSD : 0;

            costoAsignadoCUP = costoTotalCUP * proporcionCUP;
            costoAsignadoUSD = costoTotalUSD * proporcionUSD;
          }

          // Calculate separate profits for each currency
          const gananciaCUP = ingresoVentaCUP - costoAsignadoCUP;
          const gananciaUSD = ingresoVentaUSD - costoAsignadoUSD;

          // Convert USD to CUP for total calculation
          let ventaTotalCUP, gananciaTotalCUP;

          if (isUSDSale && !isCUPSale) {
            // USD-only sale: income is USD, convert to CUP for sales
            ventaTotalCUP = ingresoVentaUSD * cambioMoneda;
            // Profit is in USD, convert to CUP
            gananciaTotalCUP = gananciaUSD * cambioMoneda;
          } else if (isCUPSale && !isUSDSale) {
            // CUP-only sale
            ventaTotalCUP = ingresoVentaCUP;
            gananciaTotalCUP = gananciaCUP;
          } else {
            // Mixed sale: convert both income and costs to CUP
            ventaTotalCUP = ingresoVentaCUP + (ingresoVentaUSD * cambioMoneda);
            const costoTotalCUPConvertido = costoAsignadoCUP + (costoAsignadoUSD * cambioMoneda);
            gananciaTotalCUP = ventaTotalCUP - costoTotalCUPConvertido;
          }

          if (!productosVentas.has(productoNombre)) {
            productosVentas.set(productoNombre, {
              ventaCUP: 0,
              ventaUSD: 0,
              gananciaCUP: 0,
              gananciaUSD: 0,
              cantidad: 0,
            });
          }

          const productoData = productosVentas.get(productoNombre);
          productoData.ventaCUP += ventaTotalCUP; // Total in CUP (converted)
          productoData.ventaUSD += ingresoVentaUSD; // Keep original USD for reference
          productoData.gananciaCUP += gananciaTotalCUP; // Total profit in CUP
          productoData.gananciaUSD += 0; // Not used
          productoData.cantidad += cantidad;
        }
      }

      const totalVentasCUP = totals.ventasCupEfectivo + totals.ventasCupTransferencia;
      const totalVentasUSD = totals.ventasUsdEfectivo + totals.ventasUsdTransferencia;
      const totalVentasCUPConvertido = totalVentasCUP + (totalVentasUSD * 815);

      // Group sales by hour (0-23)
      const salesByHour = new Map();
      
      for (let i = 0; i < 24; i++) {
        salesByHour.set(i, { count: 0, totalCUP: 0, totalUSD: 0 });
      }

      for (const listaVenta of allVentas) {
        const dateTime = new Date(listaVenta.fecha_hora);
        const hour = dateTime.getHours();
        
        const hourData = salesByHour.get(hour);
        if (hourData) {
          hourData.count += 1;
          hourData.totalCUP += parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0) + 
                             parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
          hourData.totalUSD += parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0) + 
                             parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);
        }
      }

      const hourlySalesData = Array.from(salesByHour.entries()).map(([hour, data]) => ({
        hour: `${hour}:00`,
        hourValue: hour,
        count: data.count,
        totalCUP: data.totalCUP,
        totalUSD: data.totalUSD,
      }));

      const topProductosMasVendidos = Array.from(productosVentas.entries())
        .map(([nombre, data]) => ({
          nombre,
          ventaCUP: data.ventaCUP,
          ventaUSD: data.ventaUSD,
          cantidad: data.cantidad,
          porcentaje: totalVentasCUPConvertido > 0 ? (data.ventaCUP / totalVentasCUPConvertido) * 100 : 0,
        }))
        .sort((a, b) => b.ventaCUP - a.ventaCUP)
        .slice(0, 5);

      // Top 10 productos menos vendidos (por ganancias)
      const allProductos = Array.from(productosVentas.entries())
        .map(([nombre, data]) => ({
          nombre,
          ventaCUP: data.ventaCUP,
          ventaUSD: data.ventaUSD,
          gananciaCUP: data.gananciaCUP,
          gananciaUSD: data.gananciaUSD,
          cantidad: data.cantidad,
        }));

      const sortedByProfit = allProductos.sort((a, b) => a.gananciaCUP - b.gananciaCUP);
      const topProductosMenosVendidos = sortedByProfit.slice(0, 10);

      const totalGanancia = allProductos.reduce((sum, p) => sum + p.gananciaCUP, 0);

      topProductosMenosVendidos.forEach(p => {
        (p as any).porcentajeGanancia = totalGanancia !== 0 ? (p.gananciaCUP / totalGanancia) * 100 : 0;
      });

      // Calculate gross profit
      const gananciaBrutaCUP = totalVentasCUP - totals.costosCUP;
      const gananciaBrutaUSD = totalVentasUSD - totals.costosUSD;

      setReportData({ 
        chartData, 
        totals, 
        topProductosMasVendidos, 
        topProductosMenosVendidos, 
        hourlySalesData,
        gananciaBruta: { cup: gananciaBrutaCUP, usd: gananciaBrutaUSD }
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      showToast({ type: 'error', message: 'Error al generar el informe' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <p style={{ color: colors.onSurface, fontSize: '18px' }}>Acceso denegado</p>
        <p style={{ color: colors.outline }}>Solo los administradores pueden acceder a esta página</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Header 
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        currentRoute="InformeVentas"
      />
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />

      <SidebarNavigation ref={sidebarNavRef} currentRoute="InformeVentas" />

      <div 
        style={{
          padding: isMobile ? '16px' : isTablet ? '24px' : '40px',
          marginLeft: isDesktop ? '120px' : 'auto',
          paddingTop: isMobile ? '80px' : isTablet ? '100px' : '120px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <h1 style={{ 
            color: colors.onSurface, 
            fontSize: isMobile ? '24px' : isTablet ? '28px' : '32px',
            fontWeight: '700',
            fontFamily: 'Hanken Grotesk, sans-serif',
            marginBottom: '8px'
          }}>
            Informe de Ventas
          </h1>
          <p style={{ 
            color: colors.outline, 
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif'
          }}>
            Análisis detallado de ventas por fecha y producto
          </p>
        </div>

        {/* Date Range and Filter Card */}
        <div style={{ 
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          maxWidth: isDesktop ? '800px' : '100%',
          margin: '0 auto 16px auto'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              color: colors.onSurface, 
              fontSize: '18px',
              fontWeight: '600',
              fontFamily: 'Hanken Grotesk, sans-serif',
              margin: 0
            }}>
              Filtros
            </h3>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                border: `1px solid ${colors.primary}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {showAdvancedFilters ? (
                <ChevronUp size={20} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
              ) : (
                <ChevronDown size={20} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
              )}
            </button>
          </div>
          
          {/* Fecha Desde y Hasta */}
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            marginBottom: '16px',
            flexDirection: 'row'
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Desde
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.outlineVariant}`, backgroundColor: colors.background }}>
                <input
                  type="date"
                  value={startDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    setStartDate(new Date(e.target.value));
                    setFilters(prev => ({ ...prev, fecha_desde: formatLocalDate(new Date(e.target.value)) }));
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: colors.onSurface,
                    fontFamily: 'Inter, sans-serif',
                    colorScheme: isDarkMode ? 'dark' : 'light',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Hasta
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.outlineVariant}`, backgroundColor: colors.background }}>
                <input
                  type="date"
                  value={endDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    setEndDate(new Date(e.target.value));
                    setFilters(prev => ({ ...prev, fecha_hasta: formatLocalDate(new Date(e.target.value)) }));
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: colors.onSurface,
                    fontFamily: 'Inter, sans-serif',
                    colorScheme: isDarkMode ? 'dark' : 'light',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Usuario */}
          {showAdvancedFilters && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Usuario
              </label>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowUserDropdown(!showUserDropdown);
                    if (!isLoadingUsers) {
                      fetchAllUsers();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.outlineVariant}`,
                    backgroundColor: colors.background,
                    color: filters.id_usuario ? colors.onSurface : colors.outline,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <span>
                    {Array.isArray(users) && users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos los usuarios'}
                  </span>
                  {showUserDropdown ? (
                    <ChevronUp size={16} style={{ color: colors.outline }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: colors.outline }} />
                  )}
                </button>
                
                {showUserDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.outlineVariant}`,
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 10
                  }}>
                    {isLoadingUsers ? (
                      <div style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ color: colors.outline, fontSize: '12px' }}>Cargando usuarios...</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_usuario: '' }));
                            setShowUserDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: colors.onSurface,
                            fontSize: '14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          Todos los usuarios
                        </button>
                        {filteredUsers.map((userItem) => (
                          <button
                            key={userItem.id_usuario}
                            onClick={() => {
                              setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                              setShowUserDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: colors.onSurface,
                              fontSize: '14px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {userItem.nombre_natural}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tienda */}
          {showAdvancedFilters && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Tienda
              </label>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowTiendaDropdown(!showTiendaDropdown);
                    if (!isLoadingTiendas) {
                      fetchAllTiendas();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.outlineVariant}`,
                    backgroundColor: colors.background,
                    color: filters.id_tienda ? colors.onSurface : colors.outline,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <span>
                    {Array.isArray(tiendas) && tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
                  </span>
                  {showTiendaDropdown ? (
                    <ChevronUp size={16} style={{ color: colors.outline }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: colors.outline }} />
                  )}
                </button>
                
                {showTiendaDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.outlineVariant}`,
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 10
                  }}>
                    {isLoadingTiendas ? (
                      <div style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ color: colors.outline, fontSize: '12px' }}>Cargando tiendas...</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_tienda: '' }));
                            setShowTiendaDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: colors.onSurface,
                            fontSize: '14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          Todas las tiendas
                        </button>
                        {filteredTiendas.map((tiendaItem) => (
                          <button
                            key={tiendaItem.id_tienda}
                            onClick={() => {
                              setFilters(prev => ({ ...prev, id_tienda: tiendaItem.id_tienda.toString() }));
                              setShowTiendaDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: colors.onSurface,
                              fontSize: '14px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {tiendaItem.nombre}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Servicio */}
          {showAdvancedFilters && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Servicio
              </label>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowServicioDropdown(!showServicioDropdown);
                    if (!isLoadingServicios) {
                      fetchAllServicios();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.outlineVariant}`,
                    backgroundColor: colors.background,
                    color: filters.nombre_servicio ? colors.onSurface : colors.outline,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <span>
                    {filters.nombre_servicio || 'Todos los servicios'}
                  </span>
                  {showServicioDropdown ? (
                    <ChevronUp size={16} style={{ color: colors.outline }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: colors.outline }} />
                  )}
                </button>
                
                {showServicioDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.outlineVariant}`,
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 10
                  }}>
                    {isLoadingServicios ? (
                      <div style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ color: colors.outline, fontSize: '12px' }}>Cargando servicios...</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, nombre_servicio: '' }));
                            setShowServicioDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: colors.onSurface,
                            fontSize: '14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          Todos los servicios
                        </button>
                        {filteredServicios.map((servicioItem) => (
                          <button
                            key={servicioItem.nombre}
                            onClick={() => {
                              setFilters(prev => ({ ...prev, nombre_servicio: servicioItem.nombre }));
                              setShowServicioDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: colors.onSurface,
                              fontSize: '14px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {servicioItem.nombre}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Forma de Cobro */}
          {showAdvancedFilters && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Forma de Cobro
              </label>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowFormaCobroDropdown(!showFormaCobroDropdown)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.outlineVariant}`,
                    backgroundColor: colors.background,
                    color: filters.forma_cobro ? colors.onSurface : colors.outline,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <span>
                    {filters.forma_cobro || 'Todas las formas'}
                  </span>
                  {showFormaCobroDropdown ? (
                    <ChevronUp size={16} style={{ color: colors.outline }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: colors.outline }} />
                  )}
                </button>
                
                {showFormaCobroDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.outlineVariant}`,
                    borderRadius: '8px',
                    marginTop: '4px',
                    zIndex: 10
                  }}>
                    <button
                      onClick={() => {
                        setFilters(prev => ({ ...prev, forma_cobro: '' }));
                        setShowFormaCobroDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: colors.onSurface,
                        fontSize: '14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Todas las formas
                    </button>
                    {['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'].map((forma) => (
                      <button
                        key={forma}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, forma_cobro: forma }));
                          setShowFormaCobroDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: colors.onSurface,
                          fontSize: '14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      >
                        {forma}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: colors.primary,
              color: isDarkMode ? '#0b1c30' : '#ffffff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Search size={20} />
                Generar Informe
              </>
            )}
          </button>
        </div>

        {/* Report Results */}
        {reportData && (
          <>
            {/* Ventas por Día */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Ventas por Día
              </h3>
              
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <MountainChart 
                  data={reportData.chartData} 
                  width={isMobile ? 600 : 800} 
                  height={300} 
                  selectedPoint={selectedDayPoint}
                  setSelectedPoint={setSelectedDayPoint}
                />
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                {[
                  { label: 'Efectivo CUP', color: '#4CAF50' },
                  { label: 'Transferencia CUP', color: '#2196F3' },
                  { label: 'Efectivo USD', color: '#FF9800' },
                  { label: 'Transferencia USD', color: '#9C27B0' },
                  { label: 'Costos', color: '#F44336' },
                ].map((item, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px'
                  }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '2px',
                      backgroundColor: item.color
                    }} />
                    <span style={{ color: colors.onSurface, fontSize: '12px' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ventas por Hora del Día */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Ventas por Hora del Día
              </h3>
              
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <LineChart 
                  data={reportData.hourlySalesData} 
                  width={isMobile ? 600 : 800} 
                  height={300}
                  selectedPoint={selectedHourPoint}
                  setSelectedPoint={setSelectedHourPoint}
                />
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '2px',
                    backgroundColor: colors.primary
                  }} />
                  <span style={{ color: colors.onSurface, fontSize: '12px' }}>
                    Ventas por hora
                  </span>
                </div>
              </div>
            </div>

            {/* Totales del Período */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Totales del Período
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: colors.background }}>
                  <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>Efectivo CUP</div>
                  <div style={{ color: '#4CAF50', fontSize: '20px', fontWeight: '700' }}>
                    {formatNumber(reportData.totals.ventasCupEfectivo)} CUP
                  </div>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: colors.background }}>
                  <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>Transferencia CUP</div>
                  <div style={{ color: '#2196F3', fontSize: '20px', fontWeight: '700' }}>
                    {formatNumber(reportData.totals.ventasCupTransferencia)} CUP
                  </div>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: colors.background }}>
                  <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>Efectivo USD</div>
                  <div style={{ color: '#FF9800', fontSize: '20px', fontWeight: '700' }}>
                    {formatNumber(reportData.totals.ventasUsdEfectivo)} USD
                  </div>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: colors.background }}>
                  <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>Transferencia USD</div>
                  <div style={{ color: '#9C27B0', fontSize: '20px', fontWeight: '700' }}>
                    {formatNumber(reportData.totals.ventasUsdTransferencia)} USD
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: colors.background }}>
                <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>Costos por Salida o/y Ventas</div>
                <div style={{ color: '#F44336', fontSize: '20px', fontWeight: '700' }}>
                  {formatNumber(reportData.totals.costosCUP)} CUP
                </div>
              </div>
            </div>

            {/* Top 5 Productos Más Vendidos */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Top 5 Productos Más Vendidos
              </h3>
              
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'center' }}>
                {/* Pie Chart */}
                <div style={{ flex: '0 0 auto' }}>
                  {(() => {
                    const pieData = reportData.topProductosMasVendidos.map((p: any, i: number) => ({
                      value: p.ventaCUP,
                      color: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'][i],
                      label: p.nombre
                    }));
                    return <PieChart data={pieData} size={isMobile ? 150 : 200} />;
                  })()}
                </div>

                {/* Legend */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : '1fr', gap: '12px' }}>
                  {reportData.topProductosMasVendidos.map((producto: any, index: number) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px'
                    }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '2px',
                        backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'][index],
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: colors.onSurface, fontSize: '14px', fontWeight: '500' }}>
                          {producto.nombre}
                        </div>
                        <div style={{ color: colors.outline, fontSize: '12px' }}>
                          {formatNumber(producto.ventaCUP)} CUP
                        </div>
                        <div style={{ color: colors.outline, fontSize: '10px' }}>
                          Cantidad: {producto.cantidad}
                        </div>
                        <div style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>
                          {producto.porcentaje.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top 10 Productos Menos Vendidos (por ganancias) */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Top 10 Productos Menos Vendidos (por ganancias)
              </h3>
              
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'center' }}>
                {/* Pie Chart */}
                <div style={{ flex: '0 0 auto' }}>
                  {(() => {
                    const pieData = reportData.topProductosMenosVendidos.map((p: any, i: number) => ({
                      value: Math.abs(p.gananciaCUP),
                      color: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#795548', '#607D8B', '#3F51B5', '#009688', '#8BC34A'][i],
                      label: p.nombre
                    }));
                    return <PieChart data={pieData} size={isMobile ? 150 : 200} />;
                  })()}
                </div>

                {/* Legend */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : '1fr', gap: '12px' }}>
                  {reportData.topProductosMenosVendidos.map((producto: any, index: number) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px'
                    }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '2px',
                        backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#795548', '#607D8B', '#3F51B5', '#009688', '#8BC34A'][index],
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: colors.onSurface, fontSize: '14px', fontWeight: '500' }}>
                          {producto.nombre}
                        </div>
                        <div style={{ color: producto.gananciaCUP >= 0 ? '#4CAF50' : '#F44336', fontSize: '12px' }}>
                          {formatNumber(producto.gananciaCUP)} CUP
                        </div>
                        <div style={{ color: colors.outline, fontSize: '10px' }}>
                          Cantidad: {producto.cantidad}
                        </div>
                        <div style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>
                          {(producto as any).porcentajeGanancia.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ganancia Bruta */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Ganancia Bruta
              </h3>
              
              <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? 'auto' : 'repeat(2, 1fr)', gap: isMobile ? '16px' : '16px', justifyContent: isMobile ? 'center' : 'normal' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: colors.background, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>CUP</div>
                  <div style={{ color: colors.primary, fontSize: '20px', fontWeight: '700' }}>
                    {formatNumber(reportData.gananciaBruta.cup)} CUP
                  </div>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: colors.background, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>USD</div>
                  <div style={{ color: colors.primary, fontSize: '20px', fontWeight: '700' }}>
                    {formatNumber(reportData.gananciaBruta.usd)} USD
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: colors.background, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ color: colors.outline, fontSize: '12px', marginBottom: '4px' }}>Utilidad</div>
                {(() => {
                  const totalVentas = reportData.totals.ventasCupEfectivo + reportData.totals.ventasCupTransferencia + (reportData.totals.ventasUsdEfectivo + reportData.totals.ventasUsdTransferencia) * 815;
                  const totalGanancia = reportData.gananciaBruta.cup + reportData.gananciaBruta.usd * 815;
                  const utilidadPorcentaje = totalVentas > 0 ? (totalGanancia / totalVentas) * 100 : 0;
                  return (
                    <div style={{ color: utilidadPorcentaje >= 0 ? '#4CAF50' : '#F44336', fontSize: '24px', fontWeight: '700' }}>
                      {utilidadPorcentaje.toFixed(2)}%
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InformeVentasPage;
