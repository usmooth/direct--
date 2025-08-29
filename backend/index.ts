import { listeningAndCreditData } from "./data/mock-listening-and-credit-table.model";
import { listeningRecords } from "./data/mock-listening-record-table.model";
import { ListeningRecord } from "./model/listening-record.model";
import { User } from "./model/user.model";
import sha256 from "sha256";


function sortAlphabetically(firstString: string, secondString: string): string[] {
  const arrayToSort = [firstString, secondString];
  arrayToSort.sort(); 
  return arrayToSort;
}

function hashTwoUsers(firstUser: string, secondUser: string) {
  const [ alphabeticOne, alphabeticTwo ] = sortAlphabetically(firstUser, secondUser);
  const stringToHash = alphabeticOne + alphabeticTwo;
  return sha256(stringToHash);
}

function sendFeedbackToSomeone(sendTo: User, from: User) {
  // Kullanıcının kayıt kontrolü
  if (!doesUserHaveRightToSendAFeedback(from)) {
    return;
  }

  const commonListeningHash = hashTwoUsers(sendTo.userHash, from.userHash);
  // Does this hash exist, set mutualFeedback to true

  // If hash doesnt exists, create new: 
  const newListeningRecord: ListeningRecord = {
    expireDate: new Date(14),
    feedbackHash: commonListeningHash,
    mutualFeedback: false,
  }
  listeningRecords.push(newListeningRecord);
}

function doesUserHaveRightToSendAFeedback(from: User): boolean {
  const fromUsersFeedbackRecords = listeningAndCreditData.filter((record) => record.user.userHash === from.userHash);

  return fromUsersFeedbackRecords.some((record) => {
    const today = new Date();
    return record.credit.getDate() > new Date().setDate(today.getDate() - 7);
  });
}
