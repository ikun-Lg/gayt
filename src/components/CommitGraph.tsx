
import { useMemo } from 'react';
import { CommitInfo } from '../types';

interface CommitGraphProps {
  commits: CommitInfo[];
  rowHeight: number;
}

const COLUMN_WIDTH = 16;
const DOT_SIZE = 5;
const STROKE_WIDTH = 2;
const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
];

interface GraphNode {
  commit: CommitInfo;
  x: number;
  y: number;
  color: string;
  column: number;
}

interface GraphEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

export function CommitGraph({ commits, rowHeight }: CommitGraphProps) {
  // Memoize graph calculation
  const graphData = useMemo(() => {
    // Determine sort order: assume commits are mostly sorted by time desc (topological)
    // We process commit by commit to assign columns.
    
    // Logic adapted from git graph visualization algorithms:
    // 1. Maintain a list of "active" columns. Each column tracks a branch line.
    // 2. When encountering a commit:
    //    - If it's a child of a previous commit (merge base), it might continue a column.
    //    - If it's the tip of a branch (no children seen yet), it starts a new column.
    
    // Simplified logic for this MVP:
    // Map commit hash -> column index

    
    // Active "lines" flowing down. value is the parent hash it is looking for.
    // null means the slot is free.
    const activeColumns: (string | null)[] = []; 
    
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // We need to know parent-child relationships in reverse (child -> parent is standard Git)
    // But for drawing lines FROM child TO parent, standard is fine.
    
    // Pre-calculate children for each commit to know when a column ends (is this the last child?)
    // Actually simpler: just process row by row.
    
    commits.forEach((commit, index) => {
        // 1. Identify which column this commit belongs to.
        // It belongs to a column if one of the active columns is looking for this commit (is a parent of a previous commit)
        let columnIndex = activeColumns.indexOf(commit.id);
        
        if (columnIndex === -1) {
            // New branch tip or independent commit
            // Find first empty column
            columnIndex = activeColumns.indexOf(null);
            if (columnIndex === -1) {
                columnIndex = activeColumns.length;
                activeColumns.push(null);
            }
        }
        
        // 2. Determine color
        // If continuing a column, use that column's color (logic needed to persist color)
        // For distinct visual, just hash or cycle based on column index
        const color = COLORS[columnIndex % COLORS.length];
        
        // 3. Create Node
        const x = (columnIndex + 1) * COLUMN_WIDTH; // +1 padding
        const y = index * rowHeight + rowHeight / 2;
        
        nodes.push({
            commit,
            x,
            y,
            color,
            column: columnIndex
        });
        
        // 4. Update active columns for parents
        // This commit is processed. Its slot in activeColumns is now either:
        // - occupied by its first parent (continuing the line)
        // - freed (if no parents - root commit)
        // - split (if multiple parents - merge commit)
        
        activeColumns[columnIndex] = null; // Clear current slot first
        
        const parents = commit.parents || [];
        
        if (parents.length > 0) {
            // Pass the column to the first parent
            const firstParent = parents[0];
            // Check if firstParent is already tracked? (e.g. merge target)
            if (activeColumns.includes(firstParent)) {
                // Merge into existing column
                const targetCol = activeColumns.indexOf(firstParent);
                edges.push({
                    fromX: x,
                    fromY: y,
                    toX: (targetCol + 1) * COLUMN_WIDTH,
                    toY: y + rowHeight, // Curve to next row
                    color
                });
            } else {
                // Continue in current column
                activeColumns[columnIndex] = firstParent;
                edges.push({
                    fromX: x,
                    fromY: y,
                    toX: x,
                    toY: y + rowHeight,
                    color
                });
            }
            
            // Handle other parents (merge sources)
            for (let i = 1; i < parents.length; i++) {
                const parent = parents[i];
                if (activeColumns.includes(parent)) {
                     // Connect to existing column
                    const targetCol = activeColumns.indexOf(parent);
                    edges.push({
                        fromX: x,
                        fromY: y,
                        toX: (targetCol + 1) * COLUMN_WIDTH,
                        toY: y + rowHeight,
                        color
                    });
                } else {
                    // Start new column (branching out/in)
                    let freeCol = activeColumns.indexOf(null);
                    if (freeCol === -1) {
                        freeCol = activeColumns.length;
                        activeColumns.push(null);
                    }
                    activeColumns[freeCol] = parent;
                    edges.push({
                        fromX: x,
                        fromY: y,
                        toX: (freeCol + 1) * COLUMN_WIDTH,
                        toY: y + rowHeight,
                        color
                    });
                }
            }
        }
    });

    const maxCol = nodes.reduce((max, node) => Math.max(max, node.column), 0);
    const width = (maxCol + 2) * COLUMN_WIDTH + 10;
    
    return { nodes, edges, width };
  }, [commits, rowHeight]);

  return (
    <div className="absolute top-0 left-0 bottom-0 pointer-events-none z-10" style={{ width: graphData.width }}>
      <svg width={graphData.width} height={commits.length * rowHeight} className="overflow-visible">
        {graphData.edges.map((edge, i) => (
             <path
                key={`e-${i}`}
                d={`M ${edge.fromX} ${edge.fromY} 
                    C ${edge.fromX} ${edge.fromY + rowHeight/2},
                      ${edge.toX} ${edge.toY - rowHeight/2},
                      ${edge.toX} ${edge.toY}`}
                stroke={edge.color}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                opacity={0.6}
             />
        ))}
        {graphData.nodes.map((node) => (
            <g key={`n-${node.commit.id}`} transform={`translate(${node.x}, ${node.y})`}>
                <circle 
                    r={DOT_SIZE} 
                    fill={node.color} 
                    stroke="var(--background)" 
                    strokeWidth={2} 
                />
            </g>
        ))}
      </svg>
    </div>
  );
}
