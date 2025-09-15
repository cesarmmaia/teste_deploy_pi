// Configurações
const ITENS_POR_PAGINA = 10;
let dadosRelatorio = [];
let estatisticasRelatorio = {};
let paginaAtual = 1;
let filtrosAtivos = {};

// Verificar se estamos na página de relatório
function isRelatorioPage() {
    return window.location.pathname === '/relatorio' || 
           window.location.pathname.endsWith('relatorio.html');
}

// Função segura para getElementById
function getElementSafe(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Elemento não encontrado: #${id}`);
        return null;
    }
    return element;
}

// Função segura para set textContent
function setTextSafe(elementId, text) {
    const element = getElementSafe(elementId);
    if (element) {
        element.textContent = text;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (isRelatorioPage()) {
        carregarRelatorio();
        inicializarGraficos();
        setTimeout(adicionarBotaoRecarregar, 1000);
    }
});

async function carregarRelatorio() {
    if (!isRelatorioPage()) return;
    
    try {
        const response = await fetch('/api/relatorio');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('Dados recebidos da API:', data);
        
        dadosRelatorio = data.desinfeccoes || [];
        estatisticasRelatorio = data.estatisticas || {
            total: 0, ok: 0, proximo: 0, pendente: 0, com_erro: 0
        };
        
        atualizarDashboard();
        aplicarPaginacao();
    } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        
        const tbody = getElementSafe('corpoTabelaRelatorio');
        if (tbody) {
            const errorMessage = error.message.includes('500') 
                ? 'Erro interno do servidor. Verifique os logs do servidor.' 
                : `Erro: ${error.message}`;
                
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${errorMessage}
                    </td>
                </tr>
            `;
        }
        
        estatisticasRelatorio = { total: 0, ok: 0, proximo: 0, pendente: 0, com_erro: 0 };
        atualizarDashboard();
    }
}

function atualizarDashboard() {
    if (!isRelatorioPage()) return;
    
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    
    const estatisticas = estatisticasRelatorio.total !== undefined ? 
        estatisticasRelatorio : 
        {
            total: dadosFiltrados.length,
            ok: dadosFiltrados.filter(d => d.status === 'ok').length,
            proximo: dadosFiltrados.filter(d => d.status === 'proximo').length,
            pendente: dadosFiltrados.filter(d => d.status === 'pendente').length,
            com_erro: dadosFiltrados.filter(d => d.status === 'erro').length
        };
    
    // Atualizar contadores com verificação segura
    setTextSafe('countTotal', estatisticas.total || 0);
    setTextSafe('countOk', estatisticas.ok || 0);
    setTextSafe('countProximo', estatisticas.proximo || 0);
    setTextSafe('countPendente', estatisticas.pendente || 0);
    setTextSafe('countErro', estatisticas.com_erro || 0);
    
    // Atualizar tabela e gráficos se existirem
    if (getElementSafe('corpoTabelaRelatorio')) {
        atualizarTabela(dadosFiltrados);
    }
    
    if (getElementSafe('graficoMetodos') && getElementSafe('graficoStatus')) {
        atualizarGraficos(dadosFiltrados);
    }
}

function aplicarFiltros() {
    if (!isRelatorioPage()) return;
    
    const filterStatus = getElementSafe('filterStatus');
    const filterBaia = getElementSafe('filterBaia');
    const filterMetodo = getElementSafe('filterMetodo');
    const filterData = getElementSafe('filterData');
    
    if (!filterStatus || !filterBaia || !filterMetodo || !filterData) return;
    
    filtrosAtivos = {
        status: filterStatus.value,
        baia: filterBaia.value,
        metodo: filterMetodo.value,
        data: filterData.value
    };
    
    paginaAtual = 1;
    atualizarDashboard();
}

function limparFiltros() {
    if (!isRelatorioPage()) return;
    
    const filterStatus = getElementSafe('filterStatus');
    const filterBaia = getElementSafe('filterBaia');
    const filterMetodo = getElementSafe('filterMetodo');
    const filterData = getElementSafe('filterData');
    
    if (filterStatus) filterStatus.value = 'todos';
    if (filterBaia) filterBaia.value = '';
    if (filterMetodo) filterMetodo.value = 'todos';
    if (filterData) filterData.value = '';
    
    filtrosAtivos = {};
    paginaAtual = 1;
    atualizarDashboard();
}

function aplicarFiltrosNosDados(dados) {
    return dados.filter(item => {
        if (filtrosAtivos.status && filtrosAtivos.status !== 'todos' && item.status !== filtrosAtivos.status) {
            return false;
        }
        
        if (filtrosAtivos.baia && item.numero_baia != filtrosAtivos.baia) {
            return false;
        }
        
        if (filtrosAtivos.metodo && filtrosAtivos.metodo !== 'todos' && item.metodo !== filtrosAtivos.metodo) {
            return false;
        }
        
        if (filtrosAtivos.data) {
            const itemData = new Date(item.data_desinfeccao).toISOString().split('T')[0];
            const filtroData = new Date(filtrosAtivos.data).toISOString().split('T')[0];
            if (itemData !== filtroData) {
                return false;
            }
        }
        
        return true;
    });
}

function atualizarTabela(dados) {
    const tbody = getElementSafe('corpoTabelaRelatorio');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const dadosPagina = dados.slice(inicio, fim);
    
    if (dadosPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-info-circle"></i>
                    Nenhum registro encontrado
                </td>
            </tr>
        `;
        
        const infoPaginacao = getElementSafe('infoPaginacao');
        if (infoPaginacao) {
            infoPaginacao.textContent = `Mostrando 0 de ${dados.length} registros`;
        }
        return;
    }
    
    dadosPagina.forEach(item => {
        const tr = document.createElement('tr');
        
        const dataFormatada = item.data_formatada || new Date(item.data_desinfeccao).toLocaleDateString('pt-BR');
        
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.numero_baia}</td>
            <td>${dataFormatada}</td>
            <td>${item.dias_desde_desinfeccao !== undefined ? item.dias_desde_desinfeccao : 'N/A'}</td>
            <td>${formatarMetodo(item.metodo)}</td>
            <td>${item.observacao || '-'}</td>
            <td><span class="status-badge status-${item.status}">${formatarStatus(item.status)}</span></td>
            <td>${formatarDataHora(item.atualizado_em || item.criado_em)}</td>
        `;
        
        tr.style.cursor = 'pointer';
        tr.onclick = () => mostrarDetalhes(item);
        tbody.appendChild(tr);
    });
    
    const infoPaginacao = getElementSafe('infoPaginacao');
    if (infoPaginacao) {
        infoPaginacao.textContent = 
            `Mostrando ${Math.min(dadosPagina.length, ITENS_POR_PAGINA)} de ${dados.length} registros`;
    }
    
    atualizarControlesPaginacao(dados.length);
}

function formatarDataHora(dataHora) {
    if (!dataHora) return 'N/A';
    
    try {
        const data = new Date(dataHora);
        return data.toLocaleString('pt-BR');
    } catch (e) {
        return dataHora;
    }
}

function aplicarPaginacao() {
    if (!isRelatorioPage()) return;
    
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    atualizarTabela(dadosFiltrados);
}

function atualizarControlesPaginacao(totalItens) {
    const paginacao = getElementSafe('paginacao');
    if (!paginacao) return;
    
    paginacao.innerHTML = '';
    
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA);
    if (totalPaginas <= 1) return;
    
    // Botão Anterior
    const liAnterior = document.createElement('li');
    liAnterior.className = `page-item ${paginaAtual === 1 ? 'disabled' : ''}`;
    liAnterior.innerHTML = `<a class="page-link" href="#" onclick="mudarPagina(${paginaAtual - 1}); return false;">Anterior</a>`;
    paginacao.appendChild(liAnterior);
    
    // Páginas
    const paginaInicial = Math.max(1, paginaAtual - 2);
    const paginaFinal = Math.min(totalPaginas, paginaInicial + 4);
    
    for (let i = paginaInicial; i <= paginaFinal; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === paginaAtual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="mudarPagina(${i}); return false;">${i}</a>`;
        paginacao.appendChild(li);
    }
    
    // Botão Próximo
    const liProximo = document.createElement('li');
    liProximo.className = `page-item ${paginaAtual === totalPaginas ? 'disabled' : ''}`;
    liProximo.innerHTML = `<a class="page-link" href="#" onclick="mudarPagina(${paginaAtual + 1}); return false;">Próximo</a>`;
    paginacao.appendChild(liProximo);
}

function mudarPagina(pagina) {
    if (!isRelatorioPage()) return;
    
    paginaAtual = pagina;
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    atualizarTabela(dadosFiltrados);
    
    const tabela = getElementSafe('tabelaRelatorio');
    if (tabela) {
        tabela.scrollIntoView({ behavior: 'smooth' });
    }
}

function formatarStatus(status) {
    const statusMap = {
        'ok': 'No Prazo',
        'proximo': 'Próximo do Prazo',
        'pendente': 'Pendente',
        'erro': 'Com Erro',
        'agendado': 'Agendado'
    };
    return statusMap[status] || status;
}

function formatarMetodo(metodo) {
    const metodoMap = {
        'hipoclorito': 'Hipoclorito',
        'ozonio': 'Ozônio',
        'vapor': 'Vapor'
    };
    return metodoMap[metodo] || metodo;
}

function mostrarDetalhes(item) {
    const modalElement = getElementSafe('modalDetalhes');
    const conteudoElement = getElementSafe('detalhesConteudo');
    
    if (!modalElement || !conteudoElement) return;
    
    const modal = new bootstrap.Modal(modalElement);
    const dataFormatada = item.data_formatada || new Date(item.data_desinfeccao).toLocaleDateString('pt-BR');
    
    conteudoElement.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>ID:</strong> ${item.id}</p>
                <p><strong>Baia:</strong> ${item.numero_baia}</p>
                <p><strong>Data da Desinfecção:</strong> ${dataFormatada}</p>
                <p><strong>Dias desde a desinfecção:</strong> ${item.dias_desde_desinfeccao !== undefined ? item.dias_desde_desinfeccao : 'N/A'}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Método:</strong> ${formatarMetodo(item.metodo)}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${item.status}">${formatarStatus(item.status)}</span></p>
                <p><strong>Criado em:</strong> ${formatarDataHora(item.criado_em)}</p>
                <p><strong>Atualizado em:</strong> ${formatarDataHora(item.atualizado_em)}</p>
            </div>
        </div>
        <div class="mt-3">
            <strong>Observações:</strong>
            <p class="border p-2 rounded">${item.observacao || 'Nenhuma observação registrada.'}</p>
        </div>
    `;
    
    modal.show();
}

function exportarCSV() {
    if (!isRelatorioPage()) return;
    
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    
    if (dadosFiltrados.length === 0) {
        alert('Nenhum dado para exportar!');
        return;
    }
    
    let csv = 'ID,Baia,Data Desinfecção,Data Formatada,Dias Desde,Método,Observação,Status,Última Atualização\n';
    
    dadosFiltrados.forEach(item => {
        const dataFormatada = item.data_formatada || new Date(item.data_desinfeccao).toLocaleDateString('pt-BR');
        const dataHora = formatarDataHora(item.atualizado_em || item.criado_em);
        
        csv += `"${item.id}","${item.numero_baia}","${item.data_desinfeccao}","${dataFormatada}","${item.dias_desde_desinfeccao || ''}","${item.metodo}","${item.observacao || ''}","${formatarStatus(item.status)}","${dataHora}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_desinfeccao_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function imprimirRelatorio() {
    if (!isRelatorioPage()) return;
    window.print();
}

function inicializarGraficos() {
    if (!isRelatorioPage()) return;
}

function atualizarGraficos(dados) {
    if (!isRelatorioPage()) return;
    
    atualizarGraficoMetodos(dados);
    atualizarGraficoStatus(dados);
}

function atualizarGraficoMetodos(dados) {
    const ctx = getElementSafe('graficoMetodos');
    if (!ctx) return;
    
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    const contagemMetodos = {};
    dados.forEach(item => {
        if (item.metodo) {
            contagemMetodos[item.metodo] = (contagemMetodos[item.metodo] || 0) + 1;
        }
    });
    
    if (Object.keys(contagemMetodos).length === 0) {
        ctx.innerHTML = '<p class="text-muted text-center">Nenhum dado disponível para gráfico</p>';
        return;
    }
    
    ctx.chart = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(contagemMetodos).map(formatarMetodo),
            datasets: [{
                data: Object.values(contagemMetodos),
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: {
                    display: true,
                    text: 'Distribuição por Método de Desinfecção'
                }
            }
        }
    });
}

function atualizarGraficoStatus(dados) {
    const ctx = getElementSafe('graficoStatus');
    if (!ctx) return;
    
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    const contagemStatus = { 'ok': 0, 'proximo': 0, 'pendente': 0, 'erro': 0, 'agendado': 0 };
    
    dados.forEach(item => {
        if (contagemStatus.hasOwnProperty(item.status)) {
            contagemStatus[item.status]++;
        }
    });
    
    if (Object.values(contagemStatus).every(count => count === 0)) {
        ctx.innerHTML = '<p class="text-muted text-center">Nenhum dado disponível para gráfico</p>';
        return;
    }
    
    ctx.chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['No Prazo', 'Próximo do Prazo', 'Pendente', 'Com Erro', 'Agendado'],
            datasets: [{
                label: 'Quantidade de Baias',
                data: [contagemStatus.ok, contagemStatus.proximo, contagemStatus.pendente, contagemStatus.erro, contagemStatus.agendado],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Status das Baias por Prazo of Desinfecção'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Quantidade de Baias' }
                },
                x: {
                    title: { display: true, text: 'Status' }
                }
            }
        }
    });
}

function recarregarDados() {
    if (!isRelatorioPage()) return;
    
    paginaAtual = 1;
    carregarRelatorio();
    alert('Dados recarregados com sucesso!');
}

function adicionarBotaoRecarregar() {
    if (!isRelatorioPage()) return;
    
    const header = document.querySelector('.d-sm-flex.align-items-center.justify-content-between.mb-4');
    if (header && !getElementSafe('btnRecarregar')) {
        const btn = document.createElement('button');
        btn.id = 'btnRecarregar';
        btn.className = 'd-none d-sm-inline-block btn btn-sm btn-primary shadow-sm';
        btn.innerHTML = '<i class="fas fa-sync-alt fa-sm text-white-50"></i> Recarregar Dados';
        btn.onclick = recarregarDados;
        header.appendChild(btn);
    }
}