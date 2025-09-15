// Configurações
const ITENS_POR_PAGINA = 10;
let dadosRelatorio = [];
let estatisticasRelatorio = {};
let paginaAtual = 1;
let filtrosAtivos = {};

document.addEventListener('DOMContentLoaded', function() {
    carregarRelatorio();
    inicializarGraficos();
});

async function carregarRelatorio() {
    try {
        const response = await fetch('/api/relatorio');
        
        // Verificar se a resposta é bem-sucedida
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('Dados recebidos da API:', data);
        
        // A API agora retorna {estatisticas: {}, desinfeccoes: []}
        dadosRelatorio = data.desinfeccoes || [];
        estatisticasRelatorio = data.estatisticas || {
            total: 0,
            ok: 0,
            proximo: 0,
            pendente: 0,
            com_erro: 0
        };
        
        atualizarDashboard();
        aplicarPaginacao();
    } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        
        // Mostrar mensagem de erro na interface
        const errorMessage = error.message.includes('500') 
            ? 'Erro interno do servidor. Verifique os logs do servidor.' 
            : `Erro: ${error.message}`;
            
        // Mostrar mensagem na tabela
        document.getElementById('corpoTabelaRelatorio').innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${errorMessage}
                </td>
            </tr>
        `;
        
        // Zerar estatísticas em caso de erro
        estatisticasRelatorio = {
            total: 0,
            ok: 0,
            proximo: 0,
            pendente: 0,
            com_erro: 0
        };
        atualizarDashboard();
    }
}

function atualizarDashboard() {
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    
    // Usar estatísticas da API ou calcular localmente se não disponíveis
    const estatisticas = estatisticasRelatorio.total !== undefined ? 
        estatisticasRelatorio : 
        {
            total: dadosFiltrados.length,
            ok: dadosFiltrados.filter(d => d.status === 'ok').length,
            proximo: dadosFiltrados.filter(d => d.status === 'proximo').length,
            pendente: dadosFiltrados.filter(d => d.status === 'pendente').length,
            com_erro: dadosFiltrados.filter(d => d.status === 'erro').length
        };
    
    // Atualizar contadores do dashboard
    document.getElementById('countTotal').textContent = estatisticas.total || 0;
    document.getElementById('countOk').textContent = estatisticas.ok || 0;
    document.getElementById('countProximo').textContent = estatisticas.proximo || 0;
    document.getElementById('countPendente').textContent = estatisticas.pendente || 0;
    document.getElementById('countErro').textContent = estatisticas.com_erro || 0;
    
    atualizarTabela(dadosFiltrados);
    atualizarGraficos(dadosFiltrados);
}

function aplicarFiltros() {
    filtrosAtivos = {
        status: document.getElementById('filterStatus').value,
        baia: document.getElementById('filterBaia').value,
        metodo: document.getElementById('filterMetodo').value,
        data: document.getElementById('filterData').value
    };
    
    paginaAtual = 1;
    atualizarDashboard();
}

function limparFiltros() {
    document.getElementById('filterStatus').value = 'todos';
    document.getElementById('filterBaia').value = '';
    document.getElementById('filterMetodo').value = 'todos';
    document.getElementById('filterData').value = '';
    
    filtrosAtivos = {};
    paginaAtual = 1;
    atualizarDashboard();
}

function aplicarFiltrosNosDados(dados) {
    return dados.filter(item => {
        // Filtro por status
        if (filtrosAtivos.status && filtrosAtivos.status !== 'todos' && item.status !== filtrosAtivos.status) {
            return false;
        }
        
        // Filtro por número da baia
        if (filtrosAtivos.baia && item.numero_baia != filtrosAtivos.baia) {
            return false;
        }
        
        // Filtro por método
        if (filtrosAtivos.metodo && filtrosAtivos.metodo !== 'todos' && item.metodo !== filtrosAtivos.metodo) {
            return false;
        }
        
        // Filtro por data
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
    const tbody = document.getElementById('corpoTabelaRelatorio');
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
        return;
    }
    
    dadosPagina.forEach(item => {
        const tr = document.createElement('tr');
        
        // Usar data_formatada se disponível, caso contrário formatar
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
    
    // Atualizar informações de paginação
    document.getElementById('infoPaginacao').textContent = 
        `Mostrando ${Math.min(dadosPagina.length, ITENS_POR_PAGINA)} de ${dados.length} registros`;
    
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
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    atualizarTabela(dadosFiltrados);
}

function atualizarControlesPaginacao(totalItens) {
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA);
    const paginacao = document.getElementById('paginacao');
    paginacao.innerHTML = '';
    
    if (totalPaginas <= 1) return;
    
    // Botão Anterior
    const liAnterior = document.createElement('li');
    liAnterior.className = `page-item ${paginaAtual === 1 ? 'disabled' : ''}`;
    liAnterior.innerHTML = `<a class="page-link" href="#" onclick="mudarPagina(${paginaAtual - 1}); return false;">Anterior</a>`;
    paginacao.appendChild(liAnterior);
    
    // Páginas - mostrar no máximo 5 páginas com ellipsis
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
    paginaAtual = pagina;
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    atualizarTabela(dadosFiltrados);
    
    // Scroll para o topo da tabela
    document.getElementById('tabelaRelatorio').scrollIntoView({ behavior: 'smooth' });
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
    const modal = new bootstrap.Modal(document.getElementById('modalDetalhes'));
    const conteudo = document.getElementById('detalhesConteudo');
    
    const dataFormatada = item.data_formatada || new Date(item.data_desinfeccao).toLocaleDateString('pt-BR');
    
    conteudo.innerHTML = `
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
    window.print();
}

function inicializarGraficos() {
    // Os gráficos serão inicializados quando os dados estiverem disponíveis
}

function atualizarGraficos(dados) {
    atualizarGraficoMetodos(dados);
    atualizarGraficoStatus(dados);
}

function atualizarGraficoMetodos(dados) {
    const ctx = document.getElementById('graficoMetodos');
    if (!ctx) return;
    
    // Destruir gráfico anterior se existir
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
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Distribuição por Método de Desinfecção'
                }
            }
        }
    });
}

function atualizarGraficoStatus(dados) {
    const ctx = document.getElementById('graficoStatus');
    if (!ctx) return;
    
    // Destruir gráfico anterior se existir
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    const contagemStatus = {
        'ok': 0,
        'proximo': 0,
        'pendente': 0,
        'erro': 0,
        'agendado': 0
    };
    
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
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Status das Baias por Prazo de Desinfecção'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantidade de Baias'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Status'
                    }
                }
            }
        }
    });
}

// Função para recarregar os dados manualmente
function recarregarDados() {
    paginaAtual = 1;
    carregarRelatorio();
    alert('Dados recarregados com sucesso!');
}

// Adicionar botão de recarregar se necessário
function adicionarBotaoRecarregar() {
    const header = document.querySelector('.d-sm-flex.align-items-center.justify-content-between.mb-4');
    if (header && !document.getElementById('btnRecarregar')) {
        const btn = document.createElement('button');
        btn.id = 'btnRecarregar';
        btn.className = 'd-none d-sm-inline-block btn btn-sm btn-primary shadow-sm';
        btn.innerHTML = '<i class="fas fa-sync-alt fa-sm text-white-50"></i> Recarregar Dados';
        btn.onclick = recarregarDados;
        header.appendChild(btn);
    }
}

// Inicializar botão de recarregar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(adicionarBotaoRecarregar, 1000);
});