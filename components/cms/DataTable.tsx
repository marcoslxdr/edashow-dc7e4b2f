'use client'

import React from 'react'
import {
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    ArrowUpDown,
    Search,
    Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { Checkbox } from '@/components/ui/checkbox'

interface RowAction<T> {
    label: string
    icon: React.ElementType
    onClick: (item: T) => void
    variant?: 'default' | 'ghost' | 'destructive'
    className?: string
}

interface Column<T> {
    key: string
    label: string
    render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    loading?: boolean
    onRowClick?: (item: T) => void
    selectedItems?: string[]
    onSelectionChange?: (selectedIds: string[]) => void
    actions?: RowAction<T>[]
    emptyMessage?: string
}

export function DataTable<T extends { id: string | number }>({
    data,
    columns,
    loading,
    onRowClick,
    selectedItems = [],
    onSelectionChange,
    actions = [],
    emptyMessage = 'Nenhum registro encontrado.'
}: DataTableProps<T>) {
    const [page, setPage] = React.useState(1)
    const pageSize = 10
    const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
    const pageData = data.slice((page - 1) * pageSize, page * pageSize)
    const isAllSelected = pageData.length > 0 && pageData.every(item => selectedItems.includes(String(item.id)))
    const isIndeterminate = pageData.some(item => selectedItems.includes(String(item.id))) && !isAllSelected

    React.useEffect(() => {
        if (page > pageCount) setPage(pageCount)
    }, [page, pageCount])

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (!onSelectionChange) return
        if (checked === true) {
            onSelectionChange(Array.from(new Set([...selectedItems, ...pageData.map(item => String(item.id))])))
        } else {
            onSelectionChange(selectedItems.filter(id => !pageData.some(item => String(item.id) === id)))
        }
    }

    const handleSelectRow = (id: string, checked: boolean | 'indeterminate') => {
        if (!onSelectionChange) return
        if (checked === true) {
            onSelectionChange([...selectedItems, id])
        } else {
            onSelectionChange(selectedItems.filter(itemId => itemId !== id))
        }
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            {onSelectionChange && (
                                <th className="w-12 px-6 py-4">
                                    <Checkbox
                                        checked={isAllSelected || (isIndeterminate ? 'indeterminate' : false)}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all"
                                    />
                                </th>
                            )}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest"
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </th>
                            ))}
                            <th className="px-6 py-4 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {onSelectionChange && (
                                        <td className="px-6 py-4">
                                            <div className="h-4 w-4 bg-gray-100 rounded" />
                                        </td>
                                    )}
                                    {columns.map((_, j) => (
                                        <td key={j} className="px-6 py-4">
                                            <div className="h-4 bg-gray-100 rounded w-full" />
                                        </td>
                                    ))}
                                    <td className="px-6 py-4"></td>
                                </tr>
                            ))
                        ) : data.length > 0 ? (
                            pageData.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => onRowClick?.(item)}
                                    className={cn(
                                        "hover:bg-gray-50 transition-colors cursor-pointer group",
                                        onRowClick && "active:bg-gray-100",
                                        selectedItems.includes(String(item.id)) && "bg-orange-50/50 hover:bg-orange-50"
                                    )}
                                >
                                    {onSelectionChange && (
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedItems.includes(String(item.id))}
                                                onCheckedChange={(checked: any) => handleSelectRow(String(item.id), checked)}
                                                aria-label={`Select row ${item.id}`}
                                            />
                                        </td>
                                    )}
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-6 py-4 text-sm text-gray-600">
                                            {col.render ? col.render(item) : (item as any)[col.key]}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 text-right">
                                        {actions.length > 0 ? actions.map((action) => {
                                            const Icon = action.icon
                                            return (
                                                <Button
                                                    key={action.label}
                                                    variant={action.variant || 'ghost'}
                                                    size="icon"
                                                    title={action.label}
                                                    aria-label={action.label}
                                                    className={cn('text-gray-400 hover:text-gray-900', action.className)}
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        action.onClick(item)
                                                    }}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                </Button>
                                            )
                                        }) : (
                                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-900" aria-label="Mais ações">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length + (onSelectionChange ? 2 : 1)} className="px-6 py-12 text-center text-slate-500 italic">
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Placeholder */}
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                    Mostrando <span className="font-bold text-gray-700">{data.length}</span> resultados
                </p>
                <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Página anterior" className="bg-white border-gray-200 text-gray-500 hover:bg-gray-50 h-8 px-2">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                        <span className="text-xs text-gray-500">{page}/{pageCount}</span>
                        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} aria-label="Próxima página" className="bg-white border-gray-200 text-gray-500 hover:bg-gray-50 h-8 px-2">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
