"use client"

import * as React from "react"
import Image from "next/image"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowUpRight, Users, UserX, DollarSign, Filter, Loader2, MousePointerClick, Search, Smartphone, QrCode, Edit2, LogOut, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { StudentForm } from "@/components/shared/student-form"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type StudentWithStatus = {
    id: string;
    name: string;
    whatsapp: string;
    email: string | null;
    plan_type: string;
    due_day: number;
    price: number;
    status: "Atrasado" | "Vence Hoje" | "Em dia";
}

export default function DashboardPage() {
    const [activeTab, setActiveTab] = React.useState<string>("dashboard")
    const [filter, setFilter] = React.useState<"Todos" | "Atrasados" | "Vence Hoje" | "Em dia">("Todos")
    const [searchQuery, setSearchQuery] = React.useState("")
    const [students, setStudents] = React.useState<StudentWithStatus[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [stats, setStats] = React.useState({ revenue: 0, defaulters: 0, active: 0 })
    const router = useRouter()

    // WhatsApp State
    const [qrCode, setQrCode] = React.useState<string | null>(null)
    const [qrLoading, setQrLoading] = React.useState(false)
    const [waStatus, setWaStatus] = React.useState<string>("Desconectado")
    const [monthlyRevenue, setMonthlyRevenue] = React.useState<{ name: string; total: number }[]>([])
    const [isBilling, setIsBilling] = React.useState(false)

    // Edit Modal State
    const [editingStudent, setEditingStudent] = React.useState<StudentWithStatus | null>(null)
    const [editForm, setEditForm] = React.useState({ name: "", whatsapp: "", plan_type: "", due_day: 1, price: 0 })
    const [isSavingEdit, setIsSavingEdit] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)

    // Settings State
    const [messagesState, setMessagesState] = React.useState({ day0: "Carregando...", day5: "Carregando..." })
    const [isSavingMessages, setIsSavingMessages] = React.useState(false)

    React.useEffect(() => {
        if (activeTab === "dashboard") {
            fetchData()
        }
    }, [activeTab])

    React.useEffect(() => {
        let intervalId: NodeJS.Timeout;

        async function checkStatus() {
            try {
                const res = await fetch('/api/whatsapp/status')
                const data = await res.json()
                if (data.state === 'open') {
                    setWaStatus("Conectado")
                    setQrCode(null)
                    // Não dar toast.success aqui no load inicial silencioso pra não encher o saco
                }
            } catch (error) {
                console.error("Erro ao verificar status", error)
            }
        }

        // Automatic check when mounting page
        if (waStatus === "Desconectado") {
            checkStatus()
        }

        if (waStatus === "Aguardando Leitura do QR Code") {
            intervalId = setInterval(checkStatus, 3000)
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [waStatus])

    // Load messages globally on mount
    React.useEffect(() => {
        fetch('/api/settings/messages')
            .then(r => r.json())
            .then(data => setMessagesState({ day0: data.day0 || "", day5: data.day5 || "" }))
            .catch(console.error)
    }, [])

    async function fetchData() {
        setIsLoading(true)
        try {
            // 1. Fetch Students
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('*')
                .order('name')

            if (studentsError) throw studentsError;

            // 2. Fetch Payments for the last 6 months
            const today = new Date()
            const currentDay = today.getDate()

            const last6MonthsStrs: string[] = [];
            for (let i = 0; i < 6; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                last6MonthsStrs.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }

            const currentMonthStr = last6MonthsStrs[0];
            const prevMonthStr = last6MonthsStrs[1];

            const { data: paymentsData, error: paymentsError } = await supabase
                .from('payments')
                .select('*')
                .in('reference_month', last6MonthsStrs)
                .eq('status', 'paid')

            if (paymentsError) throw paymentsError;

            const paidCurrentMonthIds = new Set(paymentsData?.filter(p => p.reference_month === currentMonthStr).map(p => p.student_id) || [])
            const paidPrevMonthIds = new Set(paymentsData?.filter(p => p.reference_month === prevMonthStr).map(p => p.student_id) || [])

            let revenue = 0
            let defaultersCount = 0
            let activeCount = 0

            // 3. Process Students Data
            const processedStudents: StudentWithStatus[] = (studentsData || []).map(student => {
                if (student.is_active) activeCount++

                let sStatus: "Em dia" | "Vence Hoje" | "Atrasado" = "Atrasado"
                const hasPaidCurrent = paidCurrentMonthIds.has(student.id)
                const hasPaidPrev = paidPrevMonthIds.has(student.id)

                if (hasPaidCurrent) {
                    sStatus = "Em dia"
                    revenue += Number(student.price)
                } else {
                    if (student.due_day === currentDay) {
                        sStatus = "Vence Hoje"
                    } else if (student.due_day < currentDay) {
                        sStatus = "Atrasado"
                    } else {
                        // O vencimento deste mês ainda não chegou. Depende do pagamento do mês passado.
                        if (!hasPaidPrev) {
                            sStatus = "Atrasado"
                        } else {
                            sStatus = "Em dia"
                        }
                    }

                    // KPI de inadimplentes exato:
                    if (student.is_active) {
                        if (student.due_day <= currentDay) {
                            // Venceu neste mês e não pagou este mês
                            if (!hasPaidCurrent && student.due_day < currentDay) {
                                defaultersCount++;
                            }
                        } else {
                            // Vai vencer neste mês ainda, ou seja, pendência seria do mês passado
                            if (!hasPaidPrev) {
                                defaultersCount++;
                            }
                        }
                    }
                }

                return {
                    id: student.id,
                    name: student.name,
                    whatsapp: student.whatsapp,
                    email: student.email,
                    plan_type: student.plan_type,
                    due_day: student.due_day,
                    price: Number(student.price),
                    status: sStatus,
                }
            })

            // 4. Generate dynamic monthly data for the chart (last 6 months)
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const dynamicMonths = [];

            // last6MonthsStrs is ordered from current (index 0) to oldest (index 5)
            // We want the chart to go from oldest (index 5) to current (index 0)
            for (let i = 5; i >= 0; i--) {
                const dStr = last6MonthsStrs[i];
                const d = new Date(Number(dStr.split('-')[0]), Number(dStr.split('-')[1]) - 1, 1);

                // Aggregate revenue from payments for this month by linking to student.price
                const monthRevenue = paymentsData
                    ?.filter(p => p.reference_month === dStr)
                    .reduce((sum, p) => {
                        const studentInfo = studentsData?.find(s => s.id === p.student_id);
                        return sum + (studentInfo ? Number(studentInfo.price) : 0);
                    }, 0) || 0;

                dynamicMonths.push({
                    name: monthNames[d.getMonth()],
                    total: monthRevenue
                });
            }

            setStudents(processedStudents)
            setStats({ revenue, defaulters: defaultersCount, active: activeCount })
            setMonthlyRevenue(dynamicMonths)

        } catch (error) {
            console.error("Error fetching dashboard data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    async function togglePaymentStatus(studentId: string, currentStatus: "Atrasado" | "Vence Hoje" | "Em dia", price: number, due_day: number) {
        try {
            const today = new Date()
            const currentDay = today.getDate()
            
            const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
            
            const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

            // Determinar qual mês estamos manipulando.
            // Se o vencimento ainda NÃO chegou neste mês, e ele não está Em dia, ele deve o mês passado.
            let targetMonthStr = currentMonthStr
            if (due_day > currentDay && currentStatus !== "Em dia") {
                targetMonthStr = prevMonthStr
            }

            if (currentStatus === "Em dia") {
                // Remove the payment to mark as unpaid (sempre check both just in case, or default to current)
                // Usualmente se ele tá em dia e clica, ele quer desmarcar o pagamento que o deixou em dia.
                // Se due_day > currentDay, o pagamento que o deixou em dia foi o do mês passado, OU o atual (pago adiantado).
                // Para ser seguro, vamos apagar daquele que definimos como target.
                const { error } = await supabase
                    .from('payments')
                    .delete()
                    .eq('student_id', studentId)
                    .eq('reference_month', due_day > currentDay ? prevMonthStr : currentMonthStr)

                if (error) throw error;
                
                // Tambem tenta apagar do mes atual se ele estiver adiantado (fallback)
                if (due_day > currentDay) {
                     await supabase.from('payments').delete().eq('student_id', studentId).eq('reference_month', currentMonthStr)
                }

                toast.success("Pagamento removido. Status atualizado para pendente.")
            } else {
                // Add a payment to mark as paid
                const { error } = await supabase
                    .from('payments')
                    .insert([{
                        student_id: studentId,
                        reference_month: targetMonthStr,
                        payment_date: new Date().toISOString(),
                        amount_paid: price,
                        status: 'paid'
                    }])

                if (error) throw error;
                toast.success(`Pagamento confirmado (${targetMonthStr}). Aluno está em dia!`)
            }

            // Refresh dashboard data seamlessly
            await fetchData()
        } catch (error: any) {
            toast.error("Erro ao atualizar status: " + error.message)
        }
    }

    async function triggerBilling() {
        if (waStatus !== "Conectado") {
            toast.error("Conecte-se a uma conta do WhatsApp primeiro na aba 'Conexão WhatsApp'.");
            return;
        }

        setIsBilling(true)
        toast.info("Iniciando rotina de cobranças...")
        try {
            const res = await fetch(`/api/billing?manual=true&t=${Date.now()}`, { cache: 'no-store' })
            const data = await res.json()
            if (res.ok) {
                if (data.success) {
                    toast.success(`Cobranças iniciadas em segundo plano! (${data.totalSent} alunos na fila)`)
                } else if (data.message) {
                    // e.g., "No students due today"
                    toast.success(data.message)
                } else {
                    toast.success("Rotina concluída.")
                }
            } else {
                toast.error(data.error || "Erro ao disparar cobranças")
            }
        } catch (error: any) {
            toast.error("Erro na requisição: " + error.message)
        } finally {
            setIsBilling(false)
        }
    }

    function openEditModal(student: StudentWithStatus) {
        setEditingStudent(student)
        setEditForm({
            name: student.name,
            whatsapp: student.whatsapp,
            plan_type: student.plan_type,
            due_day: student.due_day,
            price: student.price
        })
    }

    async function handleSaveEdit() {
        if (!editingStudent) return;
        setIsSavingEdit(true)
        try {
            const { error } = await supabase
                .from('students')
                .update({
                    name: editForm.name,
                    whatsapp: editForm.whatsapp.replace(/\D/g, ''),
                    plan_type: editForm.plan_type,
                    due_day: editForm.due_day,
                    price: editForm.price
                })
                .eq('id', editingStudent.id)

            if (error) throw error;

            toast.success("Aluno atualizado com sucesso!")
            setEditingStudent(null)
            fetchData()
        } catch (error: any) {
            toast.error("Erro ao atualizar: " + error.message)
        } finally {
            setIsSavingEdit(false)
        }
    }

    async function handleDeleteStudent() {
        if (!editingStudent) return;
        
        if (!confirm(`Tem certeza que deseja EXCLUIR o aluno ${editingStudent.name}? Essa ação não pode ser desfeita.`)) {
            return;
        }

        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('students')
                .delete()
                .eq('id', editingStudent.id)

            if (error) throw error;

            toast.success("Aluno removido com sucesso!")
            setEditingStudent(null)
            fetchData()
        } catch (error: any) {
            toast.error("Erro ao remover aluno: " + error.message)
        } finally {
            setIsDeleting(false)
        }
    }

    const filteredStudents = students.filter(student => {
        // Filter by Status
        if (filter === "Atrasados" && student.status !== "Atrasado") return false
        if (filter === "Vence Hoje" && student.status !== "Vence Hoje") return false
        if (filter === "Em dia" && student.status !== "Em dia") return false

        // Filter by Text Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            const matchesName = student.name.toLowerCase().includes(query)
            const matchesPhone = student.whatsapp.includes(query)
            if (!matchesName && !matchesPhone) return false
        }

        return true
    })

    async function fetchWhatsAppQr() {
        setQrLoading(true)
        try {
            const res = await fetch('/api/whatsapp/connect')
            const data = await res.json()

            if (data.base64) {
                setQrCode(data.base64)
                setWaStatus("Aguardando Leitura do QR Code")
                toast("Escaneie o QR Code no seu WhatsApp!")
            } else if (data.status === 'open' || data.state === 'open') {
                setWaStatus("Conectado")
                setQrCode(null)
                toast.success("WhatsApp já está conectado!")
            } else if (data.count === 0 && !data.base64) {
                toast("Aguarde a API gerar o QR Code e tente novamente em 5 segundos.")
            } else {
                toast.error("Resposta inesperada da API.")
            }
        } catch (error: any) {
            toast.error("Erro ao buscar QR Code: " + error.message)
        } finally {
            setQrLoading(false)
        }
    }

    async function handleDisconnect() {
        setQrLoading(true)
        try {
            const res = await fetch('/api/whatsapp/disconnect', { method: 'DELETE' })
            if (res.ok) {
                setWaStatus("Desconectado")
                setQrCode(null)
                toast.success("WhatsApp desconectado com sucesso!")
            } else {
                const data = await res.json()
                toast.error(data.error || "Erro ao desconectar")
            }
        } catch (error: any) {
            toast.error("Erro ao desconectar: " + error.message)
        } finally {
            setQrLoading(false)
        }
    }

    async function handleSaveMessages() {
        setIsSavingMessages(true)
        try {
            const res = await fetch('/api/settings/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messagesState)
            })
            if (res.ok) {
                toast.success("Textos de cobrança salvos com sucesso!")
            } else {
                toast.error("Erro ao salvar mensagens.")
            }
        } catch (error: any) {
            toast.error("Erro: " + error.message)
        } finally {
            setIsSavingMessages(false)
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            toast.success("Logoff realizado")
            router.push('/login')
            router.refresh()
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-[100vw] overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-2">
                <div className="flex items-center gap-3">
                    <Image src="/logo.jpg" alt="Kratos Crosstraining Logo" width={48} height={48} className="rounded-md shadow-sm border border-border/50" />
                    <div className="flex items-center gap-2 sm:gap-4">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Kratos Crosstraining</h2>
                        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-red-400 -mr-2 sm:mr-0" title="Sair do sistema">
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <div className="flex w-full sm:w-auto items-center space-x-2 pt-2 sm:pt-0">
                    <Button onClick={fetchData} variant="outline" size="sm" disabled={isLoading || isBilling} className="flex-1 sm:flex-none">
                        Atualizar
                    </Button>
                    <Button onClick={triggerBilling} variant="default" size="sm" disabled={isBilling} className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none">
                        {isBilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                        Cobrar
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    <TabsList className="mb-2 sm:mb-8 min-w-max">
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="alunos">Gerenciamento de Alunos</TabsTrigger>
                        <TabsTrigger value="whatsapp">Conexão WhatsApp</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="dashboard" className="space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <Card className="border-l-4 border-l-primary/60">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Receita Esperada / Garantida</CardTitle>
                                        <DollarSign className="h-4 w-4 text-primary" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Mês corrente</p>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-l-destructive/60">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
                                        <UserX className="h-4 w-4 text-destructive" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stats.defaulters}</div>
                                        <p className="text-xs text-muted-foreground">Requer atenção imediata</p>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-l-emerald-500/60">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Alunos Ativos</CardTitle>
                                        <Users className="h-4 w-4 text-emerald-500" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stats.active}</div>
                                        <p className="text-xs text-muted-foreground">Registros na base</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                                <Card className="lg:col-span-4">
                                    <CardHeader>
                                        <CardTitle>Recebimentos (Últimos 6 meses)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pl-2">
                                        <ResponsiveContainer width="100%" height={350}>
                                            <BarChart data={monthlyRevenue}>
                                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                                                <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-3">
                                    <CardHeader>
                                        <CardTitle>Módulo de Alunos</CardTitle>
                                        <p className="text-sm text-muted-foreground">Gerencie o status de pagamento dos seus alunos.</p>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-start sm:items-center">
                                            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
                                                <Button variant={filter === "Todos" ? "default" : "outline"} size="sm" onClick={() => setFilter("Todos")}>
                                                    <Filter className="mr-2 h-3 w-3" /> Todos
                                                </Button>
                                                <Button variant={filter === "Atrasados" ? "destructive" : "outline"} size="sm" onClick={() => setFilter("Atrasados")}>
                                                    Atrasados
                                                </Button>
                                                <Button variant={filter === "Vence Hoje" ? "default" : "outline"} size="sm" className={filter === "Vence Hoje" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""} onClick={() => setFilter("Vence Hoje")}>
                                                    Vence Hoje
                                                </Button>
                                                <Button variant={filter === "Em dia" ? "default" : "outline"} size="sm" className={filter === "Em dia" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""} onClick={() => setFilter("Em dia")}>
                                                    Em dia
                                                </Button>
                                            </div>
                                            <div className="relative w-full sm:w-72">
                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Buscar aluno ou telefone..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-9 h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Aluno</TableHead>
                                                    <TableHead>Modalidade</TableHead>
                                                    <TableHead>Venc.</TableHead>
                                                    <TableHead className="text-right">Status</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredStudents.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                                            Nenhum aluno encontrado.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredStudents.map((student) => (
                                                        <TableRow key={student.id}>
                                                            <TableCell>
                                                                <div className="font-medium">{student.name}</div>
                                                                <div className="text-xs text-muted-foreground">{student.whatsapp}</div>
                                                            </TableCell>
                                                            <TableCell className="text-xs">{student.plan_type}</TableCell>
                                                            <TableCell>Dia {student.due_day}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Badge
                                                                    className="cursor-pointer hover:opacity-80 transition-all active:scale-95 shadow-sm"
                                                                    title="Clique para alterar o status de pagamento"
                                                                    onClick={() => togglePaymentStatus(student.id, student.status, student.price, student.due_day)}
                                                                    variant={
                                                                        student.status === "Atrasado" ? "destructive" :
                                                                            student.status === "Vence Hoje" ? "warning" :
                                                                                "success"
                                                                    }>
                                                                    {student.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditModal(student)} title="Editar aluno">
                                                                    <Edit2 className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="alunos">
                    <StudentForm onSuccess={() => { fetchData(); setActiveTab("dashboard") }} />
                </TabsContent>

                <TabsContent value="whatsapp" className="space-y-4">
                    <Card className="border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-emerald-500" />
                                Mensagens e Automações (Evolution API)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">Para que o sistema envie cobranças automáticas para inadimplentes, você primeiro precisa escanear o QR Code de conexão usando o WhatsApp do Kratos Crosstraining.</p>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-border rounded-lg bg-black/20">
                                <div>
                                    <p className="text-sm font-semibold mb-1">Status da Conexão:</p>
                                    <Badge variant={waStatus === "Conectado" ? "success" : waStatus === "Aguardando Leitura do QR Code" ? "warning" : "secondary"}>
                                        {waStatus}
                                    </Badge>
                                </div>
                                <Button onClick={fetchWhatsAppQr} disabled={qrLoading || waStatus === "Conectado"} className="sm:ml-auto">
                                    {qrLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                                    Gerar QR Code de Conexão
                                </Button>
                                {waStatus === "Conectado" && (
                                    <Button onClick={handleDisconnect} disabled={qrLoading} variant="destructive">
                                        Desconectar
                                    </Button>
                                )}
                            </div>

                            {qrCode && (
                                <div className="mt-8 flex flex-col items-center gap-4 justify-center bg-white p-8 rounded-lg max-w-sm mx-auto shadow-sm">
                                    <p className="text-slate-800 font-semibold text-center">Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar um Aparelho</p>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 border-4 border-slate-100 rounded shadow" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Edit2 className="h-5 w-5 text-emerald-500" />
                                Personalizar Textos de Cobrança
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Você pode usar as seguintes variáveis dinâmicas que serão trocadas na hora de enviar: <code>{'{nome}'}</code>, <code>{'{plano}'}</code>, <code>{'{valor}'}</code>.
                            </p>

                            <div className="space-y-6 pt-4">
                                <div className="space-y-2">
                                    <Label>Cobrança: Dia do Vencimento (HOJE)</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                        value={messagesState.day0}
                                        onChange={(e) => setMessagesState(prev => ({ ...prev, day0: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cobrança: Atraso de Mensalidade (+5 Dias)</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                        value={messagesState.day5}
                                        onChange={(e) => setMessagesState(prev => ({ ...prev, day5: e.target.value }))}
                                    />
                                </div>
                                <Button onClick={handleSaveMessages} disabled={isSavingMessages} className="w-full sm:w-auto">
                                    {isSavingMessages && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    Salvar Mensagens
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Editar Aluno</DialogTitle>
                        <DialogDescription>
                            Altere os dados do aluno abaixo. Clique em salvar para confirmar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp">WhatsApp</Label>
                            <Input id="whatsapp" value={editForm.whatsapp} onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="plan">Modalidade</Label>
                            <Input id="plan" value={editForm.plan_type} onChange={(e) => setEditForm(prev => ({ ...prev, plan_type: e.target.value }))} className="bg-muted" readOnly />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="due">Dia Venc.</Label>
                            <Input id="due" type="number" min="1" max="31" value={editForm.due_day} onChange={(e) => setEditForm(prev => ({ ...prev, due_day: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Valor (R$)</Label>
                            <Input id="price" type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm(prev => ({ ...prev, price: Number(e.target.value) }))} />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-0 w-full">
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteStudent} 
                            disabled={isDeleting || isSavingEdit}
                            className="mt-2 sm:mt-0"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Excluir Aluno
                        </Button>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setEditingStudent(null)} disabled={isDeleting || isSavingEdit}>Cancelar</Button>
                            <Button onClick={handleSaveEdit} disabled={isSavingEdit || isDeleting}>
                                {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
