export interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'new' | 'pending' | 'active' | 'resolved';
  assignedAgent?: string;
  tags: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: 'customer' | 'agent' | 'bot';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'document';
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  activeConversations: number;
  resolvedToday: number;
  avgResponseTime: string;
}

export interface DashboardMetrics {
  totalConversations: number;
  messagesSent: number;
  messagesReceived: number;
  avgResponseTime: string;
  resolutionRate: number;
  activeAgents: number;
}

export const dashboardMetrics: DashboardMetrics = {
  totalConversations: 1284,
  messagesSent: 8432,
  messagesReceived: 9120,
  avgResponseTime: '2m 34s',
  resolutionRate: 94.2,
  activeAgents: 8,
};

export const chartData = [
  { day: 'Seg', sent: 120, received: 145 },
  { day: 'Ter', sent: 98, received: 132 },
  { day: 'Qua', sent: 145, received: 167 },
  { day: 'Qui', sent: 132, received: 154 },
  { day: 'Sex', sent: 178, received: 198 },
  { day: 'Sáb', sent: 65, received: 78 },
  { day: 'Dom', sent: 42, received: 56 },
];

export const conversations: Conversation[] = [
  { id: '1', contactName: 'Maria Silva', contactPhone: '+55 11 98765-4321', lastMessage: 'Olá, gostaria de saber sobre o status do meu pedido', lastMessageTime: '2 min', unreadCount: 3, status: 'new', tags: ['vendas', 'urgente'] },
  { id: '2', contactName: 'João Santos', contactPhone: '+55 21 99876-5432', lastMessage: 'O produto chegou com defeito, preciso de suporte', lastMessageTime: '15 min', unreadCount: 1, status: 'active', assignedAgent: 'Ana Costa', tags: ['suporte'] },
  { id: '3', contactName: 'Ana Oliveira', contactPhone: '+55 31 97654-3210', lastMessage: 'Muito obrigada pela ajuda! 😊', lastMessageTime: '1h', unreadCount: 0, status: 'resolved', assignedAgent: 'Pedro Lima', tags: ['suporte'] },
  { id: '4', contactName: 'Carlos Mendes', contactPhone: '+55 41 96543-2109', lastMessage: 'Qual o prazo de entrega para São Paulo?', lastMessageTime: '2h', unreadCount: 2, status: 'pending', tags: ['vendas'] },
  { id: '5', contactName: 'Beatriz Ferreira', contactPhone: '+55 51 95432-1098', lastMessage: 'Vocês aceitam PIX?', lastMessageTime: '3h', unreadCount: 0, status: 'active', assignedAgent: 'Ana Costa', tags: ['financeiro'] },
  { id: '6', contactName: 'Ricardo Almeida', contactPhone: '+55 61 94321-0987', lastMessage: 'Preciso cancelar minha assinatura', lastMessageTime: '5h', unreadCount: 1, status: 'pending', tags: ['cancelamento', 'urgente'] },
  { id: '7', contactName: 'Fernanda Lima', contactPhone: '+55 71 93210-9876', lastMessage: 'Quando vocês vão ter promoção novamente?', lastMessageTime: '1d', unreadCount: 0, status: 'resolved', assignedAgent: 'Pedro Lima', tags: ['vendas'] },
  { id: '8', contactName: 'Lucas Pereira', contactPhone: '+55 81 92109-8765', lastMessage: 'Estou interessado no plano empresarial', lastMessageTime: '1d', unreadCount: 0, status: 'new', tags: ['vendas', 'B2B'] },
];

export const messages: Message[] = [
  { id: 'm1', conversationId: '1', content: 'Olá! Fiz um pedido há 3 dias e ainda não recebi atualizações.', sender: 'customer', timestamp: '10:30', status: 'read', type: 'text' },
  { id: 'm2', conversationId: '1', content: 'Olá, Maria! Bom dia! 😊 Vou verificar o status do seu pedido agora mesmo. Pode me informar o número do pedido?', sender: 'agent', timestamp: '10:32', status: 'read', type: 'text' },
  { id: 'm3', conversationId: '1', content: 'Claro! O número é #45892', sender: 'customer', timestamp: '10:33', status: 'read', type: 'text' },
  { id: 'm4', conversationId: '1', content: 'Encontrei seu pedido! Ele está em fase de separação no nosso centro de distribuição. A previsão de entrega é para amanhã, entre 9h e 18h.', sender: 'agent', timestamp: '10:35', status: 'read', type: 'text' },
  { id: 'm5', conversationId: '1', content: 'Que ótimo! Vou aguardar então. Muito obrigada!', sender: 'customer', timestamp: '10:36', status: 'read', type: 'text' },
  { id: 'm6', conversationId: '1', content: 'Olá, gostaria de saber sobre o status do meu pedido', sender: 'customer', timestamp: '14:20', status: 'delivered', type: 'text' },
];

export const agents: Agent[] = [
  { id: 'a1', name: 'Ana Costa', email: 'ana@empresa.com', status: 'online', activeConversations: 5, resolvedToday: 12, avgResponseTime: '1m 45s' },
  { id: 'a2', name: 'Pedro Lima', email: 'pedro@empresa.com', status: 'online', activeConversations: 3, resolvedToday: 8, avgResponseTime: '2m 10s' },
  { id: 'a3', name: 'Carla Souza', email: 'carla@empresa.com', status: 'away', activeConversations: 2, resolvedToday: 15, avgResponseTime: '1m 20s' },
  { id: 'a4', name: 'Bruno Martins', email: 'bruno@empresa.com', status: 'offline', activeConversations: 0, resolvedToday: 10, avgResponseTime: '3m 05s' },
];
