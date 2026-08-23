export interface LicenceCardProps {
  documentTitle: string;
  stateName: string;
  licenceNo: string;
  name: string;
  relation?: string;
  dob: string;
  blood: string;
  addressLine1: string;
  addressLine2: string;
  classCodes: string;
  issueDate: string;
  validTill: string;
  rtoCode: string;
}

/** A photo card styled after an actual Indian driving/learner's licence — dept header, chip, photo, and the standard field set. */
export function LicenceCard({ documentTitle, stateName, licenceNo, name, relation, dob, blood, addressLine1, addressLine2, classCodes, issueDate, validTill, rtoCode }: LicenceCardProps) {
  return (
    <div className="lic col g14">
      <div className="lic-head">
        <div className="col g4">
          <span className="lic-dept">Transport Department</span>
          <span className="lic-dept-sub">Government of {stateName}</span>
        </div>
        <span className="lic-doctitle">{documentTitle}</span>
      </div>
      <div className="lic-no row between g12 wrapf">
        <span>Licence No. <b>{licenceNo}</b></span>
      </div>
      <div className="lic-body">
        <dl className="lic-fields">
          <dt>Name</dt><dd>{name}</dd>
          {relation && <><dt>S/W/D</dt><dd>{relation}</dd></>}
          <dt>DOB</dt><dd>{dob}</dd>
          <dt>BG</dt><dd>{blood}</dd>
          <dt>Address</dt><dd>{addressLine1}<br />{addressLine2}</dd>
        </dl>
        <div className="lic-photo-col">
          <div className="lic-photo" />
          <span className="lic-sig">Holder's signature</span>
        </div>
      </div>
      <div className="lic-chip" aria-hidden="true"><i /><i /><i /></div>
      <div className="lic-foot row between g16 wrapf">
        <span className="col g4"><span className="lic-label">Authorisation to drive</span><b>{classCodes}</b></span>
        <span className="col g4"><span className="lic-label">Date of issue</span><b>{issueDate}</b></span>
        <span className="col g4"><span className="lic-label">Valid till</span><b>{validTill}</b></span>
        <span className="col g4" style={{ textAlign: 'right' }}><span className="lic-label">Issuing authority</span><b>{rtoCode}</b></span>
      </div>
    </div>
  );
}
