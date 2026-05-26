import { doc, getDoc, setDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

export async function getNextSequenceValue(sequenceName: string, startFrom: number = 101): Promise<number> {
  const counterRef = doc(db, 'counters', sequenceName);
  
  try {
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { current: startFrom });
        return startFrom;
      }
      
      const nextValue = counterDoc.data().current + 1;
      transaction.update(counterRef, { current: nextValue });
      return nextValue;
    });
  } catch (error) {
    console.error(`Error getting next sequence for ${sequenceName}:`, error);
    // Fallback to timestamp if counter fails
    return Date.now();
  }
}
