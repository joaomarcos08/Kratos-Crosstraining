"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"

const studentSchema = z.object({
    name: z.string().min(2, "Nome é obrigatório"),
    whatsapp: z.string().min(10, "WhatsApp é obrigatório"),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    plan_type: z.string().min(2, "Modalidade é obrigatória"),
    due_day: z.string().min(1, "Dia de vencimento inválido"),
    price: z.string().min(1, "Valor inválido"),
})

interface StudentFormProps {
    onSuccess?: () => void;
}

export function StudentForm({ onSuccess }: StudentFormProps) {
    const [isLoading, setIsLoading] = React.useState(false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<z.infer<typeof studentSchema>>({
        resolver: zodResolver(studentSchema),
        defaultValues: {
            plan_type: "Crossfit",
            due_day: "10",
            price: "150",
        }
    })

    async function onSubmit(data: z.infer<typeof studentSchema>) {
        setIsLoading(true)
        try {
            const { error } = await supabase.from("students").insert([
                {
                    name: data.name,
                    whatsapp: data.whatsapp,
                    email: data.email || null,
                    plan_type: data.plan_type,
                    due_day: parseInt(data.due_day, 10),
                    price: parseFloat(data.price),
                    is_active: true,
                },
            ])

            if (error) {
                throw error
            }

            toast.success("Aluno cadastrado com sucesso!")
            reset()
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error("Erro ao cadastrar aluno: " + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle>Cadastro de Aluno</CardTitle>
                <CardDescription>
                    Insira os dados do novo aluno para adicioná-lo ao sistema.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form id="student-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome Completo *</Label>
                            <Input id="name" placeholder="Ex: João da Silva" {...register("name")} />
                            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="whatsapp">WhatsApp (com DDD) *</Label>
                            <Input id="whatsapp" placeholder="Ex: 11999999999" {...register("whatsapp")} />
                            {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input id="email" type="email" placeholder="Opcional" {...register("email")} />
                            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="plan_type">Modalidade *</Label>
                            <Input id="plan_type" placeholder="Crossfit" readOnly {...register("plan_type")} className="bg-muted" />
                            {errors.plan_type && <p className="text-xs text-destructive">{errors.plan_type.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price">Valor da Mensalidade (R$) *</Label>
                            <Input id="price" type="number" step="0.01" placeholder="Ex: 150.00" {...register("price")} />
                            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="due_day">Dia do Vencimento *</Label>
                            <Input id="due_day" type="number" min="1" max="31" {...register("due_day")} />
                            {errors.due_day && <p className="text-xs text-destructive">{errors.due_day.message}</p>}
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter className="flex justify-end border-t p-6">
                <Button form="student-form" type="submit" disabled={isLoading}>
                    {isLoading ? "Cadastrando..." : "Cadastrar Aluno"}
                </Button>
            </CardFooter>
        </Card>
    )
}
