import { useParams } from 'react-router-dom'
import '../../styles/participants.css'
import NewCodeModal from '../../components/participants/NewCodeModal'
import InviteCodesPage from './InviteCodesPage'

export default function InviteCodeNewPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()

  return (
    <>
      <InviteCodesPage />
      <NewCodeModal studyId={studyId} />
    </>
  )
}
