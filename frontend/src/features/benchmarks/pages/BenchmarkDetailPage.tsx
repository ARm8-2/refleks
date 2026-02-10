import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Loading } from '../../../shared/components'
import { useBenchmarks } from '../../../shared/hooks'

export function BenchmarkDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { getBenchmarkByName, selectBenchmark, loading } = useBenchmarks()

  const name = id ? decodeURIComponent(id) : ''

  // Tell the provider which benchmark is selected
  useEffect(() => {
    if (name) selectBenchmark(name)
  }, [name, selectBenchmark])

  const handleBack = () => {
    selectBenchmark(null)
    navigate('/benchmarks')
  }

  if (loading) return <Loading />

  const benchmark = name ? getBenchmarkByName(name) : null

  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 bg-surface border-b border-primary px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-primary">
            {benchmark?.benchmarkName ?? id}
          </h1>
        </div>
      </div>
      <div className="p-6">
        <div className="bg-surface-2 rounded-lg border border-primary p-8 text-center">
          <p className="text-secondary text-sm">Benchmark detail view coming soon.</p>
        </div>
      </div>
    </div>
  )
}
