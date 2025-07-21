import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- Imports do Firebase ---
import { db } from './firebaseConfig.js';
import { 
  collection, onSnapshot, query, orderBy, getDocs, writeBatch, doc, updateDoc, where, limit, serverTimestamp 
} from "firebase/firestore";

// --- Imports de Ícones ---
import { 
  ChevronDown, AlertTriangle, CheckCircle, Truck, Anchor, Settings, UploadCloud, 
  ListChecks, ArrowLeft, Filter, Download, Maximize2, Minimize2, PackageOpen, Ship, AlertOctagon, Loader2, RefreshCw, LayoutGrid, Activity, History, X, Car, FileText, Lock, Unlock, KeyRound, UserCheck, UserX, CheckSquare, Square, Route, Warehouse, BarChart2
} from 'lucide-react';

// --- Função para carregar Script do Excel ---
const loadScript = (src, onLoad) => {
  if (document.querySelector(`script[src="${src}"]`)) {
    if (window.XLSX) { if (onLoad) onLoad(); }
    else { const el = document.querySelector(`script[src="${src}"]`); if (onLoad) el.addEventListener('load', onLoad); }
    return;
  }
  const script = document.createElement('script');
  script.src = src;
  if (onLoad) script.onload = onLoad;
  document.head.appendChild(script);
};

// --- Constantes e Configurações ---
const STATUS_OPTIONS = ['Todos', 'Disponível', 'Carregando', 'Aduana', 'Atrasado'];
const VAGAS_POR_PAGINA_OPTIONS = [10, 20, 41, 50, 'Todas'];
const TAMANHO_BLOCO_OPTIONS = [
  { label: 'Pequeno', value: 'pequeno', className: 'min-h-[140px] text-xs' },
  { label: 'Médio', value: 'medio', className: 'min-h-[160px] text-sm' },
  { label: 'Grande', value: 'grande', className: 'min-h-[180px] text-base' },
];
const COLUNAS_LAYOUT_OPTIONS = [ 
    { label: '2 Colunas', value: 2, className: 'grid-cols-1 sm:grid-cols-2' },
    { label: '4 Colunas', value: 4, className: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4' },
    { label: '6 Colunas', value: 6, className: 'grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' },
    { label: '8 Colunas', value: 8, className: 'grid-cols-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8' },
];
const statusVisualConfig = {
    'Disponível': { icon: CheckCircle, colorClass: 'text-green-800', bgColorClass: 'bg-green-100', borderColorClass: 'border-green-300' },
    'Carregando': { icon: Truck, colorClass: 'text-blue-800', bgColorClass: 'bg-blue-100', borderColorClass: 'border-blue-300' },
    'Aduana': { icon: Anchor, colorClass: 'text-yellow-800', bgColorClass: 'bg-yellow-100', borderColorClass: 'border-yellow-400' },
    'Atrasado': { icon: AlertTriangle, colorClass: 'text-red-800', bgColorClass: 'bg-red-100', borderColorClass: 'border-red-300' },
    'VAGA LIVRE': { icon: PackageOpen, colorClass: 'text-gray-500', bgColorClass: 'bg-gray-100', borderColorClass: 'border-gray-200'}
};
const modalVisualConfig = {
    'warning': { icon: AlertTriangle, colorClass: 'text-yellow-600' },
    'info': { icon: CheckCircle, colorClass: 'text-blue-600' },
    'success': { icon: CheckCircle, colorClass: 'text-green-600' },
    'error': { icon: AlertOctagon, colorClass: 'text-red-600' },
    'admin': { icon: KeyRound, colorClass: 'text-gray-600'}
};
const TMC_TIME_OPTIONS = Array.from({ length: (50 - 15) / 5 + 1 }, (_, i) => 15 + i * 5).map(val => ({ label: `${val} min`, value: val }));
const ONDAS_TMC = Array.from({ length: 8 }, (_, i) => i + 1);

// --- Componentes Reutilizáveis ---
const StatusIcon = ({ status, size = 18 }) => {
  const config = statusVisualConfig[status] || {};
  const IconComponent = config.icon || Loader2;
  return <IconComponent className={`${config.colorClass || 'text-gray-500'} ${status === 'pendente' ? 'animate-spin' : ''}`} size={size} />;
};

const Dropdown = ({ label, options, selectedValue, onChange, icon, id, buttonClassName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const defaultBtnClass = "inline-flex justify-between items-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500";
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button type="button" id={id} className={buttonClassName || defaultBtnClass} onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="truncate">{label || options.find(opt => opt.value === selectedValue)?.label || String(selectedValue)}</span>
        </div>
        <ChevronDown className="-mr-1 ml-2 h-5 w-5 flex-shrink-0" />
      </button>
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-60 overflow-y-auto">
          <div className="py-1">
            {options.map((option) => (
              <a key={String(option.value)} href="#"
                className={`flex justify-between items-center px-4 py-2 text-sm ${selectedValue === option.value ? 'bg-indigo-100 text-indigo-900' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onChange(option.value); setIsOpen(false); }}>
                {option.label}
                {selectedValue === option.value && <CheckCircle size={16} className="text-indigo-600"/>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BlocoVaga = ({ vaga, onStatusChange, onDragStart, isDragging, onSelect, isSelected, onMultiSelect, onAtrasadoClick, isDragLocked, tamanhoClasse }) => {
  const { Rota, Vaga: vagaNumero, Transportadora, statusTarefa, Onda, id } = vaga;
  const visualConfig = statusTarefa ? statusVisualConfig[statusTarefa] : statusVisualConfig['VAGA LIVRE'];
  const handleBlockClick = (e) => {
    if (e.target.closest('.no-propagate')) return;
    if (statusTarefa === 'Atrasado' && onAtrasadoClick) onAtrasadoClick(id);
    else if (e.metaKey || e.ctrlKey) onMultiSelect(id, e);
    else onSelect(id, !isSelected);
  };
  return (
    <div draggable={!isDragLocked} onDragStart={(e) => !isDragLocked && onDragStart(e, id)} onClick={handleBlockClick}
      className={`p-3 rounded-lg shadow-md flex flex-col justify-between transition-all duration-200 ${tamanhoClasse} ${isDragLocked ? 'cursor-default' : 'cursor-grab'} ${visualConfig.bgColorClass} ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 !border-indigo-500' : visualConfig.borderColorClass} ${isDragging ? 'opacity-50 scale-105 shadow-xl' : 'border'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center min-w-0">
          <input type="checkbox" checked={isSelected} onChange={(e) => onSelect(id, e.target.checked)} onClick={(e) => e.stopPropagation()} className="no-propagate mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 flex-shrink-0"/>
          <h3 className={`font-bold ${visualConfig.colorClass} truncate`} title={Rota}>{Rota}</h3>
        </div>
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full bg-white/70 ${visualConfig.colorClass} border ${visualConfig.borderColorClass}`}>{`Vaga ${vagaNumero}`}</span>
      </div>
      <div className="space-y-1.5 mb-3 text-gray-800">
        <p className="flex items-center" title={Transportadora}><Truck size={14} className="mr-2 text-gray-500 flex-shrink-0" /> <span className="truncate">{Transportadora}</span></p>
        <p className="flex items-center"><Activity size={14} className="mr-2 text-gray-500 flex-shrink-0" /> Onda: {Onda}</p>
      </div>
      <div className="flex items-center justify-between no-propagate mt-auto pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
        <div className="flex items-center"><StatusIcon status={statusTarefa} size={16} /><span className={`ml-1.5 font-bold ${visualConfig.colorClass}`}>{statusTarefa}</span></div>
        {Rota !== "VAGA LIVRE" && <Dropdown id={`status-vaga-${id}`} options={STATUS_OPTIONS.filter(s => s !== 'Todos').map(s => ({label:s, value:s}))} selectedValue={statusTarefa} onChange={(newStatus) => onStatusChange(id, newStatus)} label="" icon={<Settings size={14} className="m-0"/>} buttonClassName="p-1 rounded-md hover:bg-black/10"/>}
      </div>
    </div>
  );
};

const ModalComponent = ({ show, title, message, type, confirmText, cancelText, onConfirm, onCancel, children }) => {
    if (!show) return null;
    const config = modalVisualConfig[type] || modalVisualConfig['info'];
    const IconComponent = config.icon;
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
        <div className="relative bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-auto">
          <div className="flex items-start mb-4">
            <IconComponent className={`${config.colorClass} h-6 w-6 mr-3 flex-shrink-0 mt-1`} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {message && <p className="text-sm text-gray-600 mt-1">{message}</p>}
            </div>
          </div>
          {children}
          <div className="flex flex-col sm:flex-row-reverse gap-3 mt-5">
            {onConfirm && (<button type="button" onClick={onConfirm} className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{confirmText || 'Confirmar'}</button>)}
            {onCancel && (<button type="button" onClick={onCancel} className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{cancelText || 'Cancelar'}</button>)}
          </div>
        </div>
      </div>
    );
};
  
const RelatorioView = ({ vagas }) => {
  const estatisticas = useMemo(() => {
    const todasAsVagas = vagas;
    if (todasAsVagas.length === 0) return { atrasadas: 0, aduana: 0, carregando: 0, concluidas: 0, porTransportadora: {}, maisAtrasos: 'N/A' };
    const atrasadas = todasAsVagas.filter(v => v.statusTarefa === 'Atrasado').length;
    const aduana = todasAsVagas.filter(v => v.statusTarefa === 'Aduana').length;
    const carregando = todasAsVagas.filter(v => v.statusTarefa === 'Carregando').length;
    const concluidas = todasAsVagas.filter(v => v.statusTarefa === 'Disponível' && v.Rota !== 'VAGA LIVRE').length;
    const porTransportadora = todasAsVagas.reduce((acc, vaga) => {
      if (vaga.statusTarefa === 'Atrasado') {
        const transportadora = vaga.Transportadora || 'N/A';
        acc[transportadora] = (acc[transportadora] || 0) + 1;
      }
      return acc;
    }, {});
    const maisAtrasos = Object.keys(porTransportadora).length > 0 ? Object.entries(porTransportadora).sort((a, b) => b[1] - a[1])[0][0] : 'Nenhuma';
    return { atrasadas, aduana, carregando, concluidas, porTransportadora, maisAtrasos };
  }, [vagas]);

  return (
    <div className="p-4 bg-white rounded-lg shadow space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 border-b pb-3">Relatório do Dia</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-100 rounded-lg"><p className="text-sm text-blue-800">Carros Carregando</p><p className="text-3xl font-bold text-blue-900">{estatisticas.carregando}</p></div>
        <div className="p-4 bg-green-100 rounded-lg"><p className="text-sm text-green-800">Cargas Concluídas</p><p className="text-3xl font-bold text-green-900">{estatisticas.concluidas}</p></div>
        <div className="p-4 bg-red-100 rounded-lg"><p className="text-sm text-red-800">Vagas Atrasadas</p><p className="text-3xl font-bold text-red-900">{estatisticas.atrasadas}</p></div>
        <div className="p-4 bg-yellow-100 rounded-lg"><p className="text-sm text-yellow-800">Vagas em Aduana</p><p className="text-3xl font-bold text-yellow-900">{estatisticas.aduana}</p></div>
      </div>
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Detalhes de Atrasos por Transportadora</h3>
        {Object.keys(estatisticas.porTransportadora).length > 0 ? (
          <ul className="space-y-2">
            {Object.entries(estatisticas.porTransportadora).map(([transportadora, count]) => (
              <li key={transportadora} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-medium text-gray-600">{transportadora}</span>
                <span className="font-bold text-red-700">{count} atraso(s)</span>
              </li>
            ))}
          </ul>
        ) : ( <p className="text-gray-500">Nenhum atraso registrado hoje.</p> )}
        <div className="mt-4 pt-4 border-t">
          <p className="text-md font-semibold text-gray-800">Transportadora com mais atrasos: <span className="text-red-700 font-bold">{estatisticas.maisAtrasos}</span></p>
        </div>
      </div>
    </div>
  );
};


const App = () => {
  const [vagas, setVagas] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroOnda, setFiltroOnda] = useState('Todas');
  const [filtroTransportadora, setFiltroTransportadora] = useState('Todas');
  const [filtroHeaderStatus, setFiltroHeaderStatus] = useState(null);
  const [opcoesOnda, setOpcoesOnda] = useState(['Todas']);
  const [opcoesTransportadora, setOpcoesTransportadora] = useState(['Todas']);
  const [draggingItemId, setDraggingItemId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmationModalProps, setConfirmationModalProps] = useState({ show: false });
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [colunasLayout, setColunasLayout] = useState(COLUNAS_LAYOUT_OPTIONS[1].value);
  const [tamanhoBloco, setTamanhoBloco] = useState(TAMANHO_BLOCO_OPTIONS[1].value);
  const [vagasPorPagina, setVagasPorPagina] = useState(VAGAS_POR_PAGINA_OPTIONS[2]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedVagas, setSelectedVagas] = useState(new Set());
  const [lastSelectedId, setLastSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLibReady, setIsLibReady] = useState(false);
  const [historicoAlteracoes, setHistoricoAlteracoes] = useState([]);
  const [isDragLocked, setIsDragLocked] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('Teste123');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [adminAttemptCallback, setAdminAttemptCallback] = useState(null);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [currentView, setCurrentView] = useState('vagas');
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const fileInputRef = useRef(null);

  const [tmcConfig, setTmcConfig] = useState({ 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30, 7: 30, 8: 30 });
  const vagasRef = useRef(vagas);
  vagasRef.current = vagas;
  
  useEffect(() => {
    // onSnapshot para vagas
    // ATENÇÃO: Esta query agora pega TODAS as vagas. A filtragem para "ativas" é feita na VagasView.
    const q = query(collection(db, 'vagas'), orderBy('Onda'), orderBy('Vaga'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const vagasDoBanco = querySnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.inicioCarregamentoTimestamp && data.inicioCarregamentoTimestamp.toDate) {
          data.inicioCarregamentoTimestamp = data.inicioCarregamentoTimestamp.toDate();
        }
        return { id: doc.id, ...data };
      });

      const ondas = new Set(['Todas']);
      const transportadoras = new Set(['Todas']);
      vagasDoBanco.forEach(vaga => {
        if(vaga.Onda) ondas.add(vaga.Onda);
        if(vaga.Transportadora) transportadoras.add(vaga.Transportadora);
      });

      setVagas(vagasDoBanco);
      setOpcoesOnda(Array.from(ondas).sort((a,b) => (a === 'Todas' ? -1 : b === 'Todas' ? 1 : a-b)));
      setOpcoesTransportadora(Array.from(transportadoras).sort());
      setIsLoading(false);
    }, (error) => {
        console.error("Erro no listener do Firestore: ", error);
        setIsLoading(false);
    });
    
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => setIsLibReady(true));
    
    const tmcInterval = setInterval(() => {
      const currentVagas = vagasRef.current; // Usa a ref para ter a lista mais atual
      const agora = new Date();
      currentVagas.forEach(vaga => {
        if ((vaga.statusTarefa === 'Carregando' || vaga.statusTarefa === 'Aduana') && vaga.inicioCarregamentoTimestamp && !vaga.tmcPerdido) {
          const tempoLimiteEmMinutos = tmcConfig[vaga.Onda] || 30;
          const tempoLimiteEmMs = tempoLimiteEmMinutos * 60 * 1000;
          const inicioCarregamento = new Date(vaga.inicioCarregamentoTimestamp);
          const tempoDecorrido = agora.getTime() - inicioCarregamento.getTime();

          if (tempoDecorrido > tempoLimiteEmMs) {
            const vagaDocRef = doc(db, 'vagas', vaga.id);
            updateDoc(vagaDocRef, { statusTarefa: 'Atrasado', tmcPerdido: true });
            registrarHistorico(`Vaga ${vaga.Vaga} (${vaga.Rota}) perdeu TMC`);
          }
        }
      });
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(tmcInterval);
    };
  }, [tmcConfig]);

  const registrarHistorico = (acao, detalhes = null) => { setHistoricoAlteracoes(prev => [{ acao, detalhes, timestamp: new Date() }, ...prev.slice(0, 99)]); };
  const displayConfirmationModal = (props) => setConfirmationModalProps({ show: true, ...props });

  const processAndUploadToFirestore = async (data) => {
    setIsLoading(true);
    displayConfirmationModal({ title: 'Aguarde', message: 'Limpando vagas antigas e subindo as novas...', type: 'info', onConfirm: ()=>setConfirmationModalProps({show:false}) });
    
    // Lógica aprimorada para encontrar a primeira onda
    const ondasValidas = data.map(item => parseInt(item.Onda || item.onda, 10)).filter(Number.isFinite);
    let primeiraOnda = null;
    let usarSistemaDeOndas = false;

    if (ondasValidas.length > 0) {
      primeiraOnda = Math.min(...ondasValidas);
      usarSistemaDeOndas = true;
    }

    const vagasCollectionRef = collection(db, 'vagas');
    const batch = writeBatch(db);

    // Limpa as vagas antigas
    const querySnapshot = await getDocs(vagasCollectionRef);
    querySnapshot.forEach(doc => batch.delete(doc.ref));

    // Adiciona as novas vagas do arquivo
    data.forEach(item => {
      const ondaAtual = parseInt(item.Onda || item.onda, 10);
      const newVaga = {
        Rota: item.Rota || item.rota,
        Vaga: parseInt(item.Vaga || item.vaga, 10),
        Onda: ondaAtual || null, // Salva null se não houver onda
        Transportadora: item.Transportadora || item.transportadora,
        statusTarefa: 'Disponível',
        // ATUALIZADO: A vaga é ativa se não houver sistema de ondas, ou se pertencer à primeira onda
        ativa: !usarSistemaDeOndas || ondaAtual === primeiraOnda,
        tmcPerdido: false,
        inicioCarregamentoTimestamp: null
      };

      if (!newVaga.Rota || isNaN(newVaga.Vaga)) return; // Ignora linhas inválidas
      
      const newDocRef = doc(vagasCollectionRef);
      batch.set(newDocRef, newVaga);
    });

    try {
      await batch.commit();
      displayConfirmationModal({ title: 'Sucesso!', message: `Base de vagas atualizada com ${data.length} novas rotas.`, type: 'success', confirmText: 'Ok' });
    } catch (error) {
      console.error("Erro ao atualizar o banco de dados: ", error);
      displayConfirmationModal({ title: 'Erro', message: 'Não foi possível atualizar a base de vagas.', type: 'error', confirmText: 'Ok' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileUpload = (event) => {
    if (!isLibReady) { displayConfirmationModal({ title: 'Aguarde', message: 'A biblioteca de leitura de arquivos ainda está a carregar.', type: 'info', confirmText: 'Ok' }); return; }
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = window.XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = window.XLSX.utils.sheet_to_json(worksheet);
          processAndUploadToFirestore(jsonData);
        } catch (error) {
          displayConfirmationModal({ title: 'Erro no Ficheiro', message: `Falha ao processar: ${error.message}`, type: 'error', confirmText: 'Ok' });
        }
      };
      reader.readAsArrayBuffer(file);
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleFileUploadRequest = () => { if (isAdmin) fileInputRef.current?.click(); else { setAdminAttemptCallback(() => () => fileInputRef.current?.click()); setShowAdminPrompt(true); } };

  const ativarProximaVaga = async (vagaConcluida) => {
    const q = query(collection(db, "vagas"), where("Vaga", "==", vagaConcluida.Vaga), where("Onda", ">", vagaConcluida.Onda), orderBy("Onda"), limit(1));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    const vagaConcluidaRef = doc(db, "vagas", vagaConcluida.id);
    batch.update(vagaConcluidaRef, { ativa: false });
    if (!querySnapshot.empty) {
      const proximaVagaDoc = querySnapshot.docs[0];
      batch.update(proximaVagaDoc.ref, { ativa: true });
    }
    await batch.commit();
  };

  const handleStatusChange = async (idDaVaga, newStatus) => {
    const vagaOriginal = vagas.find(v => v.id === idDaVaga);
    if (!vagaOriginal || vagaOriginal.statusTarefa === newStatus) return;
    const vagaFoiConcluida = (vagaOriginal.statusTarefa === 'Carregando' || vagaOriginal.statusTarefa === 'Aduana') && newStatus === 'Disponível';
    const vagaDocRef = doc(db, 'vagas', idDaVaga);
    const dadosParaAtualizar = { statusTarefa: newStatus };
    if (newStatus === 'Carregando' && !vagaOriginal.inicioCarregamentoTimestamp) {
      dadosParaAtualizar.inicioCarregamentoTimestamp = serverTimestamp();
    }
    try {
      await updateDoc(vagaDocRef, dadosParaAtualizar);
      registrarHistorico(`Status Vaga ${vagaOriginal.Vaga} (${vagaOriginal.Rota}): ${vagaOriginal.statusTarefa} -> ${newStatus}`);
      if (vagaFoiConcluida) {
        await ativarProximaVaga(vagaOriginal);
      }
    } catch (error) {
      console.error("Erro ao atualizar a vaga: ", error);
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedVagas.size === 0) { displayConfirmationModal({ title: 'Aviso', message: 'Nenhuma vaga selecionada.', type: 'info', confirmText: 'Ok' }); return; }
    const batch = writeBatch(db);
    selectedVagas.forEach(id => {
      const docRef = doc(db, 'vagas', id);
      batch.update(docRef, { statusTarefa: newStatus });
    });
    await batch.commit();
    registrarHistorico(`${selectedVagas.size} vagas alteradas para '${newStatus}' em lote.`);
    setSelectedVagas(new Set());
  };
  
  const handleResetAllVagas = () => {
    displayConfirmationModal({
      title: 'Confirmar Reset',
      message: 'Tem a certeza que deseja resetar TODAS as vagas para o status "Disponível"?',
      type: 'warning',
      confirmText: 'Sim, Resetar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const batch = writeBatch(db);
        vagas.forEach(vaga => {
          if (vaga.Rota !== 'VAGA LIVRE') {
            const docRef = doc(db, 'vagas', vaga.id);
            batch.update(docRef, { statusTarefa: 'Disponível' });
          }
        });
        await batch.commit();
        registrarHistorico("Todas as vagas foram resetadas para 'Disponível'");
        setSelectedVagas(new Set());
      }
    });
  };

  const handleHistoryRequest = () => { if (isAdmin) setShowHistoryPanel(true); else { setAdminAttemptCallback(() => () => setShowHistoryPanel(true)); setShowAdminPrompt(true); } };
  const handleAdminLogin = (password) => { if (password === adminPassword) { setIsAdmin(true); setShowAdminPrompt(false); setPasswordInput(''); displayConfirmationModal({ title: 'Sucesso', message: 'Modo ADMIN ativado.', type: 'success', confirmText: 'Ok' }); if (adminAttemptCallback) { adminAttemptCallback(); setAdminAttemptCallback(null); } return true; } displayConfirmationModal({ title: 'Erro', message: 'Senha de ADMIN incorreta.', type: 'error', confirmText: 'Tentar Novamente' }); return false; };
  const handlePasswordChange = () => { if (newPasswordInput.length < 4) { displayConfirmationModal({ title: 'Senha Inválida', message: 'A nova senha deve ter pelo menos 4 caracteres.', type: 'error', confirmText: 'Ok' }); return; } if (newPasswordInput !== confirmPasswordInput) { displayConfirmationModal({ title: 'Erro', message: 'As novas senhas não coincidem.', type: 'error', confirmText: 'Ok' }); return; } setAdminPassword(newPasswordInput); setNewPasswordInput(''); setConfirmPasswordInput(''); displayConfirmationModal({ title: 'Sucesso', message: 'Senha de ADMIN alterada.', type: 'success', confirmText: 'Ok' }); registrarHistorico("Senha de ADMIN alterada"); };
  const handleAtrasadoVagaClick = (idVaga) => { const vaga = vagas.find(v => v.id === idVaga); displayConfirmationModal({ title: `Vaga Atrasada: ${vaga.Rota}`, message: "O veículo já está disponível para carregar?", onConfirm: () => handleStatusChange(idVaga, 'Carregando'), onCancel: () => {}, confirmText: "Sim", cancelText: "Não", type: 'info' }); };
  const exportHistoryToCSV = () => { if (historicoAlteracoes.length === 0) { displayConfirmationModal({ title: 'Aviso', message: 'Nenhum histórico para exportar.', type: 'info', confirmText: 'Ok' }); return; } const headers = ['Timestamp', 'Ação', 'Detalhes']; const rows = historicoAlteracoes.map(item => [`"${new Date(item.timestamp).toLocaleString()}"`, `"${item.acao}"`, `"${item.detalhes ? JSON.stringify(item.detalhes) : ''}"`].join(',')); const csvContent = [headers.join(','), ...rows].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'historico_vagas.csv'; link.click(); };
  
  const exportVagasDoDiaToCSV = () => {
    if (vagas.length === 0) { displayConfirmationModal({ title: 'Aviso', message: 'Não há vagas para exportar.', type: 'info', confirmText: 'Ok' }); return; }
    const headers = ['Vaga', 'Rota', 'Onda', 'Transportadora', 'Status', 'Ativa'];
    const rows = vagas.map(vaga => [ `"${vaga.Vaga || ''}"`, `"${vaga.Rota || ''}"`, `"${vaga.Onda || ''}"`, `"${vaga.Transportadora || ''}"`, `"${vaga.statusTarefa || ''}"`, `"${vaga.ativa}"` ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    const dataAtual = new Date().toISOString().slice(0, 10);
    link.download = `relatorio_vagas_completo_${dataAtual}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const exportTmcReportToCSV = () => {
    const vagasAtrasadas = vagas.filter(v => v.tmcPerdido === true);
    if (vagasAtrasadas.length === 0) { displayConfirmationModal({ title: 'Aviso', message: 'Nenhuma vaga perdeu o TMC hoje.', type: 'info', confirmText: 'Ok' }); return; }
    const headers = ['Vaga', 'Rota', 'Onda', 'Transportadora', 'Status'];
    const rows = vagasAtrasadas.map(vaga => [`"${vaga.Vaga}"`, `"${vaga.Rota}"`, `"${vaga.Onda}"`, `"${vaga.Transportadora}"`, `"Atrasado (Perdeu TMC)"`].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    const dataAtual = new Date().toISOString().slice(0, 10);
    link.download = `relatorio_tmc_${dataAtual}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const handleTmcChange = (onda, tempo) => { setTmcConfig(prevConfig => ({ ...prevConfig, [onda]: parseInt(tempo, 10) })); };
  
  const vagasAtivas = useMemo(() => vagas.filter(v => v.ativa), [vagas]);
  const vagasFiltradas = useMemo(() => vagasAtivas.filter(vaga => {
    const termoBusca = searchTerm.toLowerCase();
    const matchSearch = termoBusca ? Object.values(vaga).some(val => String(val).toLowerCase().includes(termoBusca)) : true;
    const matchStatus = filtroStatus === 'Todos' ? true : vaga.statusTarefa === filtroStatus;
    const matchOnda = filtroOnda === 'Todas' ? true : vaga.Onda === filtroOnda;
    const matchTransportadora = filtroTransportadora === 'Todas' ? true : vaga.Transportadora === filtroTransportadora;
    const matchHeader = filtroHeaderStatus ? vaga.statusTarefa === filtroHeaderStatus : true;
    return matchSearch && matchStatus && matchOnda && matchTransportadora && matchHeader;
  }), [vagasAtivas, searchTerm, filtroStatus, filtroOnda, filtroTransportadora, filtroHeaderStatus]);
  const statusCounts = useMemo(() => vagasAtivas.reduce((acc, vaga) => { acc[vaga.statusTarefa] = (acc[vaga.statusTarefa] || 0) + 1; return acc; }, {}), [vagasAtivas]);
  const totalPaginas = vagasPorPagina === 'Todas' ? 1 : Math.ceil(vagasFiltradas.length / vagasPorPagina);
  const indiceInicio = vagasPorPagina === 'Todas' ? 0 : (paginaAtual - 1) * vagasPorPagina;
  const indiceFim = vagasPorPagina === 'Todas' ? vagasFiltradas.length : indiceInicio + vagasPorPagina;
  const vagasPaginadas = vagasFiltradas.slice(indiceInicio, indiceFim);
  const tamanhoBlocoClasse = TAMANHO_BLOCO_OPTIONS.find(opt => opt.value === tamanhoBloco)?.className || '';
  const handleHeaderFilterClick = (status) => setFiltroHeaderStatus(prev => prev === status ? null : status);
  const resetFilters = () => { setSearchTerm(''); setFiltroStatus('Todos'); setFiltroOnda('Todas'); setFiltroTransportadora('Todas'); setFiltroHeaderStatus(null); };
  const handleSelectVaga = (id, isChecked) => { setSelectedVagas(prev => { const newSelected = new Set(prev); isChecked ? newSelected.add(id) : newSelected.delete(id); return newSelected; }); setLastSelectedId(id); };
  const handleMultiSelectVaga = (id, event) => { if (event.shiftKey && lastSelectedId) { const currentIds = vagasFiltradas.map(v => v.id); const lastIdx = currentIds.indexOf(lastSelectedId); const currentIdx = currentIds.indexOf(id); if (lastIdx !== -1 && currentIdx !== -1) { const [start, end] = [Math.min(lastIdx, currentIdx), Math.max(lastIdx, currentIdx)]; const inBetweenIds = currentIds.slice(start, end + 1); setSelectedVagas(prev => { const newSelected = new Set(prev); const shouldSelect = !newSelected.has(id); inBetweenIds.forEach(id => shouldSelect ? newSelected.add(id) : newSelected.delete(id)); return newSelected; }); } } else if (event.metaKey || event.ctrlKey) { setSelectedVagas(prev => { const newSelected = new Set(prev); newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id); return newSelected; }); } else { setSelectedVagas(prev => { const isSelected = prev.has(id); if (isSelected && prev.size === 1) return new Set(); return new Set([id]); }); } setLastSelectedId(id); };
  const handleSelectAll = () => setSelectedVagas(new Set(vagasPaginadas.map(v => v.id)));
  const handleClearSelection = () => setSelectedVagas(new Set());
  const toggleFullScreen = useCallback(() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }, []);
  useEffect(() => { const cb = () => setIsFullScreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', cb); return () => document.removeEventListener('fullscreenchange', cb); }, []);

  if (isLoading && vagas.length === 0) {
    return ( <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex flex-col items-center justify-center z-[100]"> <Loader2 className="h-16 w-16 text-indigo-400 animate-spin mb-4" /> <p className="text-white text-xl">A carregar...</p> </div> );
  }

  const VagasView = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {['Disponível', 'Carregando', 'Atrasado', 'Aduana'].map(status => {
            const count = statusCounts[status] || 0;
            const config = statusVisualConfig[status];
            return (
                <button key={status} onClick={() => handleHeaderFilterClick(status)} className={`p-4 rounded-lg shadow-sm text-left transition-all duration-200 ${filtroHeaderStatus === status ? 'ring-2 ring-indigo-500 scale-105' : 'hover:scale-105'} ${config.bgColorClass}`}>
                    <div className="flex items-center justify-between">
                        <span className={`text-2xl font-bold ${config.colorClass}`}>{count}</span>
                        <StatusIcon status={status} size={24} />
                    </div>
                    <p className={`text-sm font-semibold mt-1 ${config.colorClass}`}>{status}</p>
                </button>
            )
        })}
      </div>
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <input type="text" placeholder="Buscar em tudo..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setPaginaAtual(1);}} className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 lg:col-span-2"/>
          <Dropdown id="filtro-status-geral" options={STATUS_OPTIONS.map(s=>({label:s, value:s}))} selectedValue={filtroStatus} onChange={(val) => {setFiltroStatus(val); setPaginaAtual(1);}} icon={<Filter size={16} className="mr-2"/>} label="Status"/>
          <Dropdown id="filtro-onda-view" options={opcoesOnda.map(o=>({label: o === 'Todas' ? 'Todas as Ondas' : `Onda ${o}`, value:o}))} selectedValue={filtroOnda} onChange={(val) => {setFiltroOnda(val); setPaginaAtual(1);}} icon={<Activity size={16} className="mr-2"/>} label="Onda"/>
          <Dropdown id="filtro-transportadora-view" options={opcoesTransportadora.map(t=>({label:t === 'Todas' ? 'Todas as Transportadoras' : t, value:t}))} selectedValue={filtroTransportadora} onChange={(val) => {setFiltroTransportadora(val); setPaginaAtual(1);}} icon={<Truck size={16} className="mr-2"/>} label="Transportadora"/>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><button onClick={handleSelectAll} className="p-2 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-md shadow-sm flex items-center justify-center transition-colors text-sm" title="Selecionar Todas as Vagas Visíveis"><CheckSquare size={16} className="mr-2"/>Selecionar Todas</button><button onClick={handleClearSelection} className="p-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md shadow-sm flex items-center justify-center transition-colors text-sm" title="Limpar Seleção"><Square size={16} className="mr-2"/>Limpar Seleção</button></div>
            {selectedVagas.size > 0 && (<div className="flex items-center gap-3"><span className="text-sm font-medium text-gray-700">{selectedVagas.size} vaga(s) selecionada(s)</span><Dropdown id="bulk-actions-dropdown" label="Ação em Lote" icon={<ListChecks size={16} />} options={STATUS_OPTIONS.filter(s => s !== 'Todos').map(s => ({label: `Marcar como ${s}`, value: s}))} selectedValue={null} onChange={handleBulkStatusChange} /></div>)}
            <button onClick={resetFilters} className="p-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md shadow-sm flex items-center justify-center transition-colors text-sm" title="Limpar Filtros"><RefreshCw size={16} className="mr-2"/> Limpar Filtros</button>
        </div>
      </div>
      {vagasPaginadas.length > 0 ? (
        <div className={`grid ${COLUNAS_LAYOUT_OPTIONS.find(c=>c.value===colunasLayout)?.className || 'grid-cols-4'} gap-4 md:gap-5`} onDragOver={(e)=>e.preventDefault()}>
          {vagasPaginadas.map(vaga => ( <div key={vaga.id} onDragOver={(e)=>e.preventDefault()}> <BlocoVaga vaga={vaga} onStatusChange={handleStatusChange} isDragging={draggingItemId === vaga.id} isSelected={selectedVagas.has(vaga.id)} onSelect={handleSelectVaga} onMultiSelect={handleMultiSelectVaga} onAtrasadoClick={handleAtrasadoVagaClick} isDragLocked={isDragLocked} tamanhoClasse={tamanhoBlocoClasse} /> </div> ))}
        </div>
      ) : ( <div className="text-center py-10 bg-white rounded-lg shadow"><PackageOpen size={48} className="mx-auto text-gray-400 mb-4" /><p className="text-xl text-gray-600">Nenhuma vaga encontrada.</p><p className="text-sm text-gray-500">Ajuste os filtros ou carregue um ficheiro.</p></div> )}
      {vagasFiltradas.length > 0 && vagasPorPagina !== 'Todas' && totalPaginas > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between">
          <div className="text-sm text-gray-700 mb-2 sm:mb-0">
            A mostrar <span className="font-medium">{indiceInicio + 1}</span> a <span className="font-medium">{Math.min(indiceFim, vagasFiltradas.length)}</span> de <span className="font-medium">{vagasFiltradas.length}</span> vagas ativas
          </div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button onClick={() => setPaginaAtual(p => p - 1)} disabled={paginaAtual === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Anterior</button>
            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">Página {paginaAtual} de {totalPaginas}</span>
            <button onClick={() => setPaginaAtual(p => p + 1)} disabled={paginaAtual === totalPaginas} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Próxima</button>
          </nav>
        </div>
      )}
    </>
  );

  const RotasView = () => {
    const transportadoras = opcoesTransportadora.filter(t => t !== 'Todas');
    const rotasFiltradas = selectedCarrier ? vagas.filter(d => d.Transportadora === selectedCarrier) : [];
    return (
        <div className="p-4 bg-white rounded-lg shadow">
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Selecione uma Transportadora</h3>
                <div className="flex flex-wrap gap-2">
                    {transportadoras.map((carrier, index) => (
                        <button key={`${carrier}-${index}`} onClick={() => setSelectedCarrier(carrier)} className={`px-4 py-2 rounded-md font-semibold transition-colors text-sm flex items-center gap-2 ${selectedCarrier === carrier ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                            <Truck size={16}/>{carrier}
                        </button>
                    ))}
                </div>
            </div>
            {selectedCarrier ? (
                <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Rotas para: {selectedCarrier}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {rotasFiltradas.length > 0 ? rotasFiltradas.map((rota) => (
                            <div key={rota.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                                <p className="font-bold text-indigo-700 text-lg">{rota.Rota}</p>
                                <p className="text-sm text-gray-600 mt-2">Vaga: <span className="font-semibold">{rota.Vaga}</span></p>
                                <p className="text-sm text-gray-600">Onda: <span className="font-semibold">{rota.Onda}</span></p>
                            </div>
                        )) : ( <p className="col-span-full text-center text-gray-500">Nenhuma rota encontrada para esta transportadora.</p> )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Route size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-xl text-gray-600">Nenhuma transportadora selecionada</p>
                    <p className="text-sm text-gray-500 mt-1">Por favor, selecione uma das opções acima para visualizar as rotas.</p>
                </div>
            )}
        </div>
    );
  }

  // --- Renderização Principal ---
  return (
    <div className={`flex flex-col min-h-screen bg-gray-100 font-sans ${isFullScreen ? 'overflow-hidden' : ''}`}>
      <header className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-4 shadow-lg sticky top-0 z-40">
          <div className="container mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-y-3">
                <h1 className="text-2xl font-bold tracking-tight flex items-center"><LayoutGrid size={28} className="mr-3 text-indigo-400" />Gerenciador de Vagas</h1>
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <button onClick={handleFileUploadRequest} className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded-full text-white transition-colors" title="Carregar Ficheiro (CSV, XLSX)"><UploadCloud size={20} /></button>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
                    <button onClick={handleHistoryRequest} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-white transition-colors" title="Histórico"><History size={20} /></button>
                    <button onClick={() => setShowConfigPanel(p => !p)} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-white transition-colors" title="Configurações"><Settings size={20} /></button>
                    <button onClick={toggleFullScreen} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-white transition-colors" title={isFullScreen ? "Sair Tela Cheia" : "Tela Cheia"}>{isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
                </div>
            </div>
            <div className="mt-4 border-t border-gray-600 pt-3 flex gap-2">
                <button onClick={() => setCurrentView('vagas')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${currentView === 'vagas' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}><Warehouse size={16}/>Painel de Vagas</button>
                <button onClick={() => setCurrentView('rotas')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${currentView === 'rotas' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}><Route size={16}/>Rotas por Transportadora</button>
                <button onClick={() => setCurrentView('relatorio')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${currentView === 'relatorio' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}><BarChart2 size={16}/>Relatório do Dia</button>
            </div>
          </div>
      </header>

      <div className={`fixed top-0 right-0 h-full bg-white shadow-xl p-6 z-50 transform transition-transform duration-300 ease-in-out ${showConfigPanel ? 'translate-x-0' : 'translate-x-full'} w-full max-w-sm sm:max-w-md overflow-y-auto`}>
            <div className="flex justify-between items-center mb-6 pb-3 border-b"><h2 className="text-xl font-semibold text-gray-800">Configurações</h2><button onClick={() => setShowConfigPanel(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"><X size={24} /></button></div>
            <div className="space-y-6 pb-16">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Layout em Colunas (Grid):</label><Dropdown id="colunasLayout" options={COLUNAS_LAYOUT_OPTIONS} selectedValue={colunasLayout} onChange={setColunasLayout} icon={<LayoutGrid size={16} className="mr-2"/>}/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tamanho dos Blocos:</label><Dropdown id="tamanhoBloco" options={TAMANHO_BLOCO_OPTIONS} selectedValue={tamanhoBloco} onChange={setTamanhoBloco} icon={<Maximize2 size={16} className="mr-2"/>}/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Vagas por Página:</label><Dropdown id="vagasPorPagina" options={VAGAS_POR_PAGINA_OPTIONS.map(opt => ({label: opt === 'Todas' ? 'Mostrar Todas' : `${opt} vagas`, value: opt}))} selectedValue={vagasPorPagina} onChange={(val) => { setVagasPorPagina(val); setPaginaAtual(1); }} icon={<ListChecks size={16} className="mr-2"/>}/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Arrastar Blocos:</label><button onClick={() => setIsDragLocked(prev => !prev)} className={`w-full flex items-center justify-center p-2 rounded-md text-white font-semibold transition-colors ${ isDragLocked ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600' }`}>{isDragLocked ? <Lock size={16} className="mr-2"/> : <Unlock size={16} className="mr-2"/>}{isDragLocked ? 'Bloqueado' : 'Desbloqueado'}</button></div>
                
                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Config TMC</h3>
                    <div className="space-y-2">
                        {ONDAS_TMC.map(onda => (
                            <div key={onda} className="grid grid-cols-2 items-center">
                                <label className="text-sm font-medium text-gray-700">Onda {onda}:</label>
                                <Dropdown
                                    id={`tmc-onda-${onda}`}
                                    options={TMC_TIME_OPTIONS}
                                    selectedValue={tmcConfig[onda]}
                                    onChange={(tempo) => handleTmcChange(onda, tempo)}
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={exportTmcReportToCSV} className="w-full mt-4 p-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold flex items-center justify-center gap-2">
                        <Download size={16} /> Baixar Relatório TMC
                    </button>
                </div>
                
                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Acesso Restrito</h3>
                    {isAdmin ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
                            <div className="flex items-center gap-2"><UserCheck size={20} className="text-green-700" /><p className="font-semibold text-green-800">Modo ADMIN Ativo</p></div>
                            <button onClick={exportVagasDoDiaToCSV} className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold flex items-center justify-center gap-2"><FileText size={16} /> Baixar Relatório de Vagas do Dia</button>
                            <button onClick={handleResetAllVagas} className="w-full p-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold flex items-center justify-center gap-2"><AlertTriangle size={16} />Resetar Todas as Vagas</button>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Alterar Senha:</label>
                                <input type="password" placeholder="Nova Senha" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                                <input type="password" placeholder="Confirmar Nova Senha" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                                <button onClick={handlePasswordChange} className="w-full p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Salvar Nova Senha</button>
                            </div>
                            <button onClick={() => setIsAdmin(false)} className="w-full p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 mt-4 flex items-center justify-center gap-2"><UserX size={16} />Sair do Modo Admin</button>
                        </div>
                    ) : (
                         <div className="space-y-2">
                             <label className="block text-sm font-medium text-gray-700">Senha de ADMIN:</label>
                             <input type="password" placeholder="Digite a senha" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin(passwordInput)} className="w-full p-2 border border-gray-300 rounded-md"/>
                             <button onClick={() => handleAdminLogin(passwordInput)} className="w-full p-2 bg-gray-700 text-white rounded-md hover:bg-gray-800">Entrar como Admin</button>
                         </div>
                    )}
                </div>
            </div>
       </div>
       
      <div className={`fixed top-0 right-0 h-full bg-white shadow-xl p-6 z-50 transform transition-transform duration-300 ease-in-out ${showHistoryPanel ? 'translate-x-0' : 'translate-x-full'} w-full max-w-md sm:max-w-lg`}>
        <div className="flex justify-between items-center mb-6 pb-3 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Histórico de Alterações</h2>
          <div className="flex items-center gap-2">
              <button onClick={exportHistoryToCSV} className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded-full text-white transition-colors" title="Exportar Histórico"><FileText size={20} /></button>
              <button onClick={() => setShowHistoryPanel(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"><X size={24} /></button>
          </div>
        </div>
        <ul className="space-y-3 h-[calc(100%-60px)] overflow-y-auto">
          {historicoAlteracoes.length > 0 ? historicoAlteracoes.map((item, index) => (
              <li key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200 text-sm">
                  <p className="font-medium text-gray-700">{item.acao}</p>
                  <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                  {item.detalhes && <pre className="mt-1 text-xs text-gray-600 bg-gray-100 p-1.5 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(item.detalhes, null, 2)}</pre>}
              </li>
          )) : <p className="text-gray-500">Nenhuma alteração registada.</p>}
        </ul>
      </div>

      <main className="flex-1 container mx-auto p-4 md:p-6">
        {currentView === 'vagas' && <VagasView />}
        {currentView === 'rotas' && <RotasView />}
        {currentView === 'relatorio' && <RelatorioView vagas={vagas} />}
      </main>

       <ModalComponent {...confirmationModalProps} 
            onConfirm={() => { confirmationModalProps.onConfirm?.(); setConfirmationModalProps(p => ({...p, show: false})); }}
            onCancel={() => { confirmationModalProps.onCancel?.(); setConfirmationModalProps(p => ({...p, show: false})); }}
       />
       <ModalComponent show={showAdminPrompt} title="Acesso ADMIN Requerido" type="admin" onCancel={() => { setShowAdminPrompt(false); setPasswordInput('');}} cancelText="Cancelar">
          <div className="space-y-2 mt-4">
              <label className="block text-sm font-medium text-gray-700">Por favor, insira a senha de ADMIN para continuar:</label>
              <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin(passwordInput)} className="w-full p-2 border border-gray-300 rounded-md" autoFocus/>
              <button onClick={() => handleAdminLogin(passwordInput)} className="w-full p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Confirmar</button>
          </div>
       </ModalComponent>
    </div>
  );
};

export default App;
