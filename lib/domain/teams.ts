import { Project, projects } from './projects';
import { User, users } from './users';

export interface Team {
   id: string;
   /** Human-readable issue prefix, e.g. CORE. */
   key?: string;
   name: string;
   icon: string;
   joined: boolean;
   /** Retired: all history stays readable, nothing new can be created in it. */
   archived?: boolean;
   /** Free text shown on the team's overview page. */
   description?: string | null;
   color: string;
   createdAt?: string;
   updatedAt?: string;
   members: User[];
   projects: Project[];
}

export const teams: Team[] = [
   {
      id: 'CORE',
      name: 'LNDev Core',
      icon: '🛠️',
      joined: true,
      color: '#FF0000',
      members: [users[8], users[10], users[2], users[3], users[4]],
      projects: [projects[5], projects[8], projects[3]],
   },
   {
      id: 'DESIGN',
      name: 'Design System',
      icon: '🎨',
      joined: true,
      color: '#00FF00',
      members: [users[7], users[3]],
      projects: [projects[1], projects[1], projects[2], projects[3]],
   },
   {
      id: 'PERF',
      name: 'Performance Lab',
      icon: '☀️',
      joined: false,
      color: '#0000FF',
      members: [users[5], users[0], users[1], users[2], users[3], users[4], users[6]],
      projects: [projects[8], projects[8]],
   },
   {
      id: 'UX',
      name: 'UX Team',
      icon: '👨🏼‍🎨',
      joined: false,
      color: '#FF00FF',
      members: [users[3]],
      projects: [projects[1], projects[1], projects[2], projects[3]],
   },
   {
      id: 'DATA',
      name: 'Data Science',
      icon: '📊',
      joined: false,
      color: '#0000FF',
      members: [users[8], users[9], users[10]],
      projects: [projects[4]],
   },
   {
      id: 'MOBILE',
      name: 'Mobile Development',
      icon: '📱',
      joined: false,
      color: '#0000FF',
      members: [],
      projects: [],
   },
   {
      id: 'WEB',
      name: 'Web Development',
      icon: '🌐',
      joined: true,
      color: '#0000FF',
      members: [users[8], users[9], users[10], users[11]],
      projects: [projects[1], projects[2]],
   },
   {
      id: 'UI',
      name: 'UI Team',
      icon: '👨🏼‍🎨',
      joined: false,
      color: '#FF00FF',
      members: [users[6], users[7], users[2], users[3], users[4], users[5]],
      projects: [projects[1], projects[0], projects[2]],
   },
   {
      id: 'CLOUD',
      name: 'Cloud Infrastructure',
      icon: '☁️',
      joined: false,
      color: '#4A90E2',
      members: [users[1], users[5], users[11], users[9]],
      projects: [projects[6], projects[7]],
   },
   {
      id: 'SECURITY',
      name: 'Security Team',
      icon: '🔒',
      joined: false,
      color: '#2E2E2E',
      members: [users[4], users[8], users[11]],
      projects: [projects[0], projects[5], projects[8]],
   },
   {
      id: 'AI',
      name: 'AI Research',
      icon: '🧠',
      joined: true,
      color: '#9B59B6',
      members: [users[2], users[10], users[7], users[5]],
      projects: [projects[4], projects[8]],
   },
   {
      id: 'QA',
      name: 'Quality Assurance',
      icon: '✅',
      joined: false,
      color: '#F1C40F',
      members: [users[3], users[6], users[1]],
      projects: [projects[2], projects[3], projects[7]],
   },
   {
      id: 'DEVOPS',
      name: 'DevOps',
      icon: '⚙️',
      joined: false,
      color: '#E67E22',
      members: [users[0], users[4], users[9]],
      projects: [projects[5], projects[6]],
   },
   {
      id: 'FRONTEND',
      name: 'Frontend Experts',
      icon: '🖥️',
      joined: false,
      color: '#1ABC9C',
      members: [users[7], users[3], users[11], users[2]],
      projects: [projects[1], projects[2]],
   },
   {
      id: 'BACKEND',
      name: 'Backend Engineers',
      icon: '🗄️',
      joined: false,
      color: '#34495E',
      members: [users[0], users[8], users[10]],
      projects: [projects[0], projects[5], projects[8]],
   },
   {
      id: 'PRODUCT',
      name: 'Product',
      icon: '📋',
      joined: false,
      color: '#C0392B',
      members: [users[1], users[6], users[9]],
      projects: [projects[3], projects[4]],
   },
   {
      id: 'ANALYTICS',
      name: 'Analytics Team',
      icon: '📈',
      joined: false,
      color: '#7F8C8D',
      members: [users[5], users[10], users[8]],
      projects: [projects[4], projects[7]],
   },
   {
      id: 'INNO',
      name: 'Innovation Lab',
      icon: '💡',
      joined: false,
      color: '#F39C12',
      members: [users[2], users[7], users[11], users[4]],
      projects: [projects[8], projects[8]],
   },
   {
      id: 'API',
      name: 'API Development',
      icon: '🔌',
      joined: false,
      color: '#16A085',
      members: [users[0], users[8], users[10], users[4]],
      projects: [projects[0], projects[5]],
   },
   {
      id: 'UXR',
      name: 'UX Research',
      icon: '🔍',
      joined: false,
      color: '#8E44AD',
      members: [users[3], users[6], users[9], users[7]],
      projects: [projects[1], projects[3], projects[4]],
   },
];
