import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Loading, Page } from '../components/ui'

/** Einladungslink: /beitreten/CODE tritt der Gruppe bei und öffnet sie */
export default function JoinPage() {
  const code = useParams().code ?? ''
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .joinGroup(code)
      .then((id) => alive && navigate(`/gruppe/${id}`, { replace: true }))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [code, navigate])

  if (!error) return <Page nav={false}><Loading /></Page>
  return (
    <Page nav={false}>
      <div className="px-4 pt-10">
        <Card className="flex flex-col gap-3">
          <h1 className="m-0 text-xl font-extrabold">Beitritt nicht möglich</h1>
          <div className="text-sm leading-normal text-ink-2">{error}. Bitte den Link noch einmal anfordern.</div>
          <Link to="/freunde" className="text-sm font-bold">Zu „Freunde"</Link>
        </Card>
      </div>
    </Page>
  )
}
