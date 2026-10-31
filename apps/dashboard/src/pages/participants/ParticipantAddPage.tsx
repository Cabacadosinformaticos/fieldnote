import { useParams } from 'react-router-dom'
import '../../styles/participants.css'
import AddParticipantModal from '../../components/participants/AddParticipantModal'
import ParticipantsPage from './ParticipantsPage'

export default function ParticipantAddPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()

  return (
    <>
      <ParticipantsPage />
      <AddParticipantModal studyId={studyId} />
    </>
  )
}
